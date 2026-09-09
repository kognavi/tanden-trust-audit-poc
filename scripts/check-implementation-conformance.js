#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const { validateSpecDirectory, splitSections } = require("./check-spec-readiness");

const GOVERNANCE_PREFIXES = ["knowledge/30-learnings/"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function parseAffectedComponents(designMarkdown) {
  const sections = splitSections(designMarkdown);
  const body = sections.get("Affected Components") || "";
  const entries = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    const backtick = String.fromCharCode(96);
    let value = null;

    if (line.startsWith("- " + backtick) && line.endsWith(backtick)) {
      value = line.slice(3, -1).trim();
    } else if (line.startsWith("- ")) {
      value = line.slice(2).trim();
    }

    if (!value) continue;
    const cleaned = value.replace(/\s+#.*$/, "").replace(/\s+\(.*\)$/, "").trim();

    if (
      cleaned.includes("/") ||
      /\.(js|json|md|yml|yaml|ts|tsx|jsx|toml|tf|sh|mjs|cjs)$/i.test(cleaned)
    ) {
      entries.push(cleaned);
    }
  }

  return [...new Set(entries)];
}

function pathAllowed(changedPath, allowedEntries, featureSlug) {
  const normalized = toPosix(changedPath);
  const featureSpecPrefix = ".kiro/specs/" + featureSlug + "/";

  if (normalized.startsWith(featureSpecPrefix)) return true;
  if (GOVERNANCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;

  return allowedEntries.some((entry) => {
    const allowed = toPosix(entry);
    if (allowed.endsWith("/")) return normalized.startsWith(allowed);
    return normalized === allowed;
  });
}

function isSensitivePath(filePath) {
  const normalized = toPosix(filePath).toLowerCase();
  return (
    normalized.startsWith("infra/") ||
    normalized.startsWith(".github/workflows/") ||
    normalized.includes("iam") ||
    normalized.includes("kms") ||
    normalized.includes("terraform") ||
    normalized.includes("policy")
  );
}

function extractHandoffProvenance(markdown) {
  const sections = splitSections(markdown);
  const body = sections.get("Provenance") || "";
  const tick = String.fromCharCode(96);
  const result = { sourceContext: null, contextId: null, specDir: null };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();

    function extract(label) {
      const prefix = "- " + label + ": " + tick;
      if (line.startsWith(prefix) && line.endsWith(tick)) {
        return line.slice(prefix.length, -1);
      }
      return null;
    }

    result.sourceContext = result.sourceContext || extract("Source Context Pack");
    result.contextId = result.contextId || extract("Context ID");
    result.specDir = result.specDir || extract("Spec directory");
  }

  return result;
}

function sectionNonEmpty(markdown, sectionName) {
  const sections = splitSections(markdown);
  return (sections.get(sectionName) || "").trim().length > 0;
}

function getChangedFilesFromGit(repositoryRoot, baseRef = "main") {
  const output = childProcess.execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", baseRef + "...HEAD"],
    { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(toPosix);
}

function validateImplementationConformance(repositoryRoot, featureSlug, options = {}) {
  validateFeatureSlug(featureSlug);
  const root = path.resolve(repositoryRoot);
  const errors = [];

  const readiness = validateSpecDirectory(root, featureSlug);
  if (!readiness.ready) {
    return { conformant: false, errors: ["Spec is not ready", ...readiness.errors] };
  }

  const specDir = path.join(root, ".kiro", "specs", featureSlug);
  const designPath = path.join(specDir, "design.md");
  const handoffPath = path.join(specDir, "implementation-handoff.md");

  if (!fs.existsSync(handoffPath)) {
    return { conformant: false, errors: ["implementation-handoff.md is missing"] };
  }

  const design = fs.readFileSync(designPath, "utf8");
  const handoff = fs.readFileSync(handoffPath, "utf8");
  const allowedEntries = parseAffectedComponents(design);

  if (allowedEntries.length === 0) {
    errors.push("design.md has no path-like Affected Components");
  }

  const provenance = extractHandoffProvenance(handoff);
  if (provenance.sourceContext !== readiness.sourceContext) {
    errors.push("Source Context Pack differs between readiness and handoff");
  }
  if (provenance.contextId !== readiness.contextId) {
    errors.push("Context ID differs between readiness and handoff");
  }

  const expectedSpecDir = ".kiro/specs/" + featureSlug;
  if (provenance.specDir !== expectedSpecDir) {
    errors.push("Spec directory provenance is missing or inconsistent");
  }

  const changedFiles = Array.isArray(options.changedFiles)
    ? options.changedFiles.map(toPosix)
    : getChangedFilesFromGit(root, options.baseRef || "main");

  for (const changedFile of changedFiles) {
    if (!pathAllowed(changedFile, allowedEntries, featureSlug)) {
      errors.push("changed file is outside Spec Affected Components: " + changedFile);
    }
  }

  const sensitiveFiles = changedFiles.filter(isSensitivePath);
  if (sensitiveFiles.length > 0) {
    for (const sectionName of ["Trust Boundary Impact", "Security", "Cost and Operations"]) {
      if (!sectionNonEmpty(design, sectionName)) {
        errors.push("sensitive changes require non-empty design section: " + sectionName);
      }
    }
  }

  return {
    conformant: errors.length === 0,
    errors,
    changedFiles,
    allowedEntries,
    sensitiveFiles,
    sourceContext: readiness.sourceContext,
    contextId: readiness.contextId,
    specDir: expectedSpecDir
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const featureSlug = process.argv[2];
  const baseRef = process.argv[3] || "main";

  if (!featureSlug) {
    console.error("Usage: node scripts/check-implementation-conformance.js <feature-slug> [base-ref]");
    process.exitCode = 2;
    return;
  }

  try {
    const result = validateImplementationConformance(repositoryRoot, featureSlug, { baseRef });
    if (!result.conformant) {
      console.error("Implementation NOT CONFORMANT: " + featureSlug);
      for (const error of result.errors) console.error("- " + error);
      process.exitCode = 1;
      return;
    }

    console.log("Implementation CONFORMANT: " + featureSlug);
    console.log("- Source Context Pack: " + result.sourceContext);
    console.log("- Context ID: " + result.contextId);
    console.log("- Changed files: " + result.changedFiles.length);
  } catch (error) {
    console.error("Implementation conformance check failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  GOVERNANCE_PREFIXES,
  extractHandoffProvenance,
  getChangedFilesFromGit,
  isSensitivePath,
  parseAffectedComponents,
  pathAllowed,
  sectionNonEmpty,
  validateImplementationConformance
};
