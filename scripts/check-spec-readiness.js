#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { validateFeatureSlug } = require("./scaffold-spec-from-context");

const REQUIRED_FILES = ["requirements.md", "design.md", "tasks.md"];
const REQUIRED_SECTIONS = {
  "requirements.md": [
    "Source Context Pack",
    "Purpose",
    "Current Implementation Truth",
    "Requirements",
    "Invariants",
    "Acceptance Criteria",
    "Open Questions",
    "Review Gate"
  ],
  "design.md": [
    "Source Context Pack",
    "Current State",
    "Proposed Design",
    "Affected Components",
    "Trust Boundary Impact",
    "Security",
    "Cost and Operations",
    "Alternatives Considered",
    "Validation Plan",
    "Review Checklist"
  ],
  "tasks.md": ["Source Context Pack"]
};

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function splitSections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = new Map();
  let current = null;
  let buffer = [];

  function flush() {
    if (current !== null) sections.set(current, buffer.join("\n").trim());
  }

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      current = match[1].trim();
      buffer = [];
    } else if (current !== null) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function extractSourceContext(markdown) {
  const sections = splitSections(markdown);
  const source = sections.get("Source Context Pack") || "";
  const tick = String.fromCharCode(96);
  const escapedTick = "\\x60";
  const pathPattern = new RegExp(escapedTick + "([^" + escapedTick + "]+\\.md)" + escapedTick);
  const idPattern = new RegExp("Context ID:\\s*" + escapedTick + "([^" + escapedTick + "]+)" + escapedTick, "i");
  const pathMatch = source.match(pathPattern);
  const idMatch = source.match(idPattern);
  return {
    path: pathMatch ? pathMatch[1] : null,
    id: idMatch ? idMatch[1] : null
  };
}

function findPlaceholders(markdown) {
  const matches = markdown.match(/<[^>\n]+>/g) || [];
  return [...new Set(matches)];
}

function findUncheckedReviewItems(markdown) {
  const sections = splitSections(markdown);
  const body = sections.get("Review Checklist");
  if (!body) return [];
  return body
    .split("\n")
    .filter((line) => /^\s*-\s*\[\s\]\s+/.test(line))
    .map((line) => line.trim());
}

function findUnresolvedOpenQuestions(markdown) {
  const sections = splitSections(markdown);
  const body = sections.get("Open Questions");
  if (body === undefined) return [];

  const normalized = body.trim();
  if (!normalized) return [];

  const lower = normalized.toLowerCase();
  if (
    lower === "none" ||
    lower === "- none" ||
    lower === "resolved: none" ||
    lower === "- resolved: none"
  ) {
    return [];
  }

  return normalized
    .split("\n")
    .filter((line) => /^\s*-\s+\S+/.test(line))
    .map((line) => line.trim());
}

function validateRequiredSections(fileName, markdown) {
  const sections = splitSections(markdown);
  const errors = [];
  for (const section of REQUIRED_SECTIONS[fileName] || []) {
    if (!sections.has(section)) errors.push(fileName + ": missing required section '" + section + "'");
  }
  return errors;
}

function validateSpecDirectory(repositoryRoot, featureSlug) {
  validateFeatureSlug(featureSlug);
  const root = path.resolve(repositoryRoot);
  const specDir = path.join(root, ".kiro", "specs", featureSlug);
  const errors = [];
  const contents = {};

  if (!fs.existsSync(specDir) || !fs.statSync(specDir).isDirectory()) {
    return {
      ready: false,
      specDir,
      errors: ["spec directory does not exist: " + toPosix(path.relative(root, specDir))]
    };
  }

  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(specDir, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      errors.push(fileName + ": missing required spec file");
      continue;
    }
    contents[fileName] = fs.readFileSync(filePath, "utf8");
  }

  if (errors.length > 0) return { ready: false, specDir, errors };

  const sources = {};
  for (const fileName of REQUIRED_FILES) {
    const markdown = contents[fileName];
    errors.push(...validateRequiredSections(fileName, markdown));

    for (const placeholder of findPlaceholders(markdown)) {
      errors.push(fileName + ": unresolved placeholder " + placeholder);
    }

    if (fileName === "requirements.md") {
      for (const question of findUnresolvedOpenQuestions(markdown)) {
        errors.push(fileName + ": unresolved open question " + question);
      }
    }

    for (const item of findUncheckedReviewItems(markdown)) {
      errors.push(fileName + ": unchecked review item " + item);
    }

    sources[fileName] = extractSourceContext(markdown);
    if (!sources[fileName].path) errors.push(fileName + ": missing Source Context Pack path");
    if (!sources[fileName].id) errors.push(fileName + ": missing Context ID");
  }

  const sourceValues = REQUIRED_FILES.map((name) => sources[name] && sources[name].path).filter(Boolean);
  const idValues = REQUIRED_FILES.map((name) => sources[name] && sources[name].id).filter(Boolean);

  if (new Set(sourceValues).size > 1) errors.push("Source Context Pack path differs across spec files");
  if (new Set(idValues).size > 1) errors.push("Context ID differs across spec files");

  return {
    ready: errors.length === 0,
    specDir,
    errors,
    sourceContext: sourceValues[0] || null,
    contextId: idValues[0] || null
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const featureSlug = process.argv[2];

  if (!featureSlug) {
    console.error("Usage: node scripts/check-spec-readiness.js <feature-slug>");
    process.exitCode = 2;
    return;
  }

  try {
    const result = validateSpecDirectory(repositoryRoot, featureSlug);
    if (!result.ready) {
      console.error("Spec NOT READY: " + featureSlug);
      for (const error of result.errors) console.error("- " + error);
      process.exitCode = 1;
      return;
    }

    console.log("Spec READY: " + featureSlug);
    console.log("- Source Context Pack: " + result.sourceContext);
    console.log("- Context ID: " + result.contextId);
  } catch (error) {
    console.error("Spec readiness check failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  REQUIRED_FILES,
  REQUIRED_SECTIONS,
  extractSourceContext,
  findPlaceholders,
  findUncheckedReviewItems,
  findUnresolvedOpenQuestions,
  splitSections,
  validateRequiredSections,
  validateSpecDirectory
};
