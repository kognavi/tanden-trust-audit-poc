#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");

const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const { validateImplementationConformance } = require("./check-implementation-conformance");

function stableStringify(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function digestPayload(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function createEvidenceDocument(payload) {
  return {
    payload,
    digest: {
      algorithm: "sha256",
      value: digestPayload(payload)
    }
  };
}

function verifyEvidenceDocument(document) {
  if (!document || !document.payload || !document.digest) return false;
  if (document.digest.algorithm !== "sha256") return false;
  return document.digest.value === digestPayload(document.payload);
}

function parseSecurityReview(markdown) {
  const statusMatch = markdown.match(/^\s*-\s*Status:\s*(.+)\s*$/mi);
  const reviewerMatch = markdown.match(/^\s*-\s*Reviewed by:\s*(.+)\s*$/mi);
  return {
    status: statusMatch ? statusMatch[1].trim() : null,
    reviewedBy: reviewerMatch ? reviewerMatch[1].trim() : null
  };
}

function runStructureValidation(repositoryRoot) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    const output = childProcess.execFileSync(
      command,
      ["run", "check:structure"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    return {
      passed: true,
      command: "npm run check:structure",
      output: output.trim()
    };
  } catch (error) {
    return {
      passed: false,
      command: "npm run check:structure",
      output: [error.stdout, error.stderr].filter(Boolean).join("\n").trim()
    };
  }
}

function validateVerificationEvidenceGate(repositoryRoot, featureSlug, options = {}) {
  validateFeatureSlug(featureSlug);
  const root = path.resolve(repositoryRoot);
  const baseRef = options.baseRef || "main";
  const errors = [];

  const conformance = options.conformanceResult || validateImplementationConformance(
    root,
    featureSlug,
    {
      baseRef,
      ...(Array.isArray(options.changedFiles) ? { changedFiles: options.changedFiles } : {})
    }
  );

  if (!conformance.conformant) {
    return {
      verified: false,
      errors: ["Implementation Conformance Gate failed", ...(conformance.errors || [])],
      conformance
    };
  }

  const structure = options.structureResult ||
    (options.structureRunner || runStructureValidation)(root);

  if (!structure.passed) {
    errors.push("npm run check:structure failed");
  }

  let securityReview = { status: "N/A", reviewedBy: null };
  const sensitiveFiles = conformance.sensitiveFiles || [];
  if (sensitiveFiles.length > 0) {
    const securityReviewPath = path.join(
      root,
      ".kiro",
      "specs",
      featureSlug,
      "security-review.md"
    );

    if (!fs.existsSync(securityReviewPath)) {
      errors.push("sensitive changes require security-review.md");
    } else {
      securityReview = parseSecurityReview(fs.readFileSync(securityReviewPath, "utf8"));
      if (securityReview.status !== "PASS") {
        errors.push("security-review.md must declare Status: PASS");
      }
      if (!securityReview.reviewedBy) {
        errors.push("security-review.md must declare Reviewed by");
      }
    }
  }

  if (errors.length > 0) {
    return {
      verified: false,
      errors,
      conformance,
      structure,
      securityReview
    };
  }

  const now = options.now || new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    gate: "verification-evidence-gate",
    feature: featureSlug,
    generatedAt: now,
    baseRef,
    status: "PASS",
    provenance: {
      sourceContext: conformance.sourceContext,
      contextId: conformance.contextId,
      specDir: conformance.specDir
    },
    checks: {
      implementationConformance: "PASS",
      structureValidation: "PASS",
      securityReview: securityReview.status
    },
    commands: {
      structureValidation: structure.command || "npm run check:structure"
    },
    changedFiles: conformance.changedFiles || [],
    sensitiveFiles,
    securityReview
  };

  const evidence = createEvidenceDocument(payload);
  const outputPath = path.join(
    root,
    ".kiro",
    "specs",
    featureSlug,
    "verification-evidence.json"
  );

  if (options.write !== false) {
    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + "\n");
  }

  return {
    verified: true,
    errors: [],
    evidence,
    outputPath,
    conformance,
    structure,
    securityReview
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const featureSlug = process.argv[2];
  const baseRef = process.argv[3] || "main";

  if (!featureSlug) {
    console.error("Usage: node scripts/run-verification-evidence-gate.js <feature-slug> [base-ref]");
    process.exitCode = 2;
    return;
  }

  try {
    const result = validateVerificationEvidenceGate(repositoryRoot, featureSlug, { baseRef });
    if (!result.verified) {
      console.error("Verification & Evidence Gate FAILED: " + featureSlug);
      for (const error of result.errors) console.error("- " + error);
      process.exitCode = 1;
      return;
    }

    console.log("Verification & Evidence Gate PASS: " + featureSlug);
    console.log("- Evidence Pack: " + path.relative(repositoryRoot, result.outputPath));
    console.log("- Digest: " + result.evidence.digest.value);
    console.log("- Changed files: " + result.evidence.payload.changedFiles.length);
    console.log("- Sensitive files: " + result.evidence.payload.sensitiveFiles.length);
  } catch (error) {
    console.error("Verification & Evidence Gate failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  createEvidenceDocument,
  digestPayload,
  parseSecurityReview,
  runStructureValidation,
  stableStringify,
  validateVerificationEvidenceGate,
  verifyEvidenceDocument
};
