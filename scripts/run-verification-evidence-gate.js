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

function parseReviewArtifact(markdown) {
  const statusMatch = markdown.match(/^\s*-\s*Status:\s*(.+)\s*$/mi);
  const reviewerMatch = markdown.match(/^\s*-\s*Reviewed by:\s*(.+)\s*$/mi);
  return {
    status: statusMatch ? statusMatch[1].trim() : null,
    reviewedBy: reviewerMatch ? reviewerMatch[1].trim() : null
  };
}

function parseSecurityReview(markdown) {
  return parseReviewArtifact(markdown);
}

function readDelegation(repositoryRoot, featureSlug) {
  const delegationPath = path.join(
    repositoryRoot,
    ".kiro",
    "specs",
    featureSlug,
    "agent-delegation.json"
  );
  if (!fs.existsSync(delegationPath)) {
    return { valid: false, error: "agent-delegation.json is missing" };
  }

  try {
    const document = JSON.parse(fs.readFileSync(delegationPath, "utf8"));
    if (document.feature !== featureSlug) {
      return { valid: false, error: "delegation feature does not match requested feature" };
    }
    const roles = document.roles || {};
    if (!roles.builder || !roles.reviewer) {
      return { valid: false, error: "delegation requires builder and reviewer identities" };
    }
    if (roles.builder === roles.reviewer) {
      return { valid: false, error: "builder and reviewer identities must differ" };
    }
    if (roles.securityReviewer && roles.securityReviewer === roles.builder) {
      return { valid: false, error: "builder and securityReviewer identities must differ" };
    }
    return { valid: true, document, roles };
  } catch (error) {
    return { valid: false, error: "agent-delegation.json is invalid JSON" };
  }
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

  const delegation = options.delegationResult || readDelegation(root, featureSlug);
  if (!delegation.valid) {
    errors.push(delegation.error);
  }

  let reviewerReview = { status: null, reviewedBy: null };
  if (delegation.valid) {
    const reviewerReviewPath = path.join(
      root,
      ".kiro",
      "specs",
      featureSlug,
      "reviewer-review.md"
    );
    if (!fs.existsSync(reviewerReviewPath)) {
      errors.push("reviewer-review.md is missing");
    } else {
      reviewerReview = parseReviewArtifact(fs.readFileSync(reviewerReviewPath, "utf8"));
      if (reviewerReview.status !== "PASS") {
        errors.push("reviewer-review.md must declare Status: PASS");
      }
      if (!reviewerReview.reviewedBy) {
        errors.push("reviewer-review.md must declare Reviewed by");
      } else if (reviewerReview.reviewedBy !== delegation.roles.reviewer) {
        errors.push("reviewer-review.md Reviewed by must match delegated reviewer identity");
      }
    }
  }

  let securityReview = { status: "N/A", reviewedBy: null };
  const sensitiveFiles = conformance.sensitiveFiles || [];
  if (sensitiveFiles.length > 0) {
    if (!delegation.valid || !delegation.roles.securityReviewer) {
      errors.push("sensitive changes require delegated securityReviewer identity");
    }
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
      } else if (
        delegation.valid &&
        delegation.roles.securityReviewer &&
        securityReview.reviewedBy !== delegation.roles.securityReviewer
      ) {
        errors.push("security-review.md Reviewed by must match delegated securityReviewer identity");
      }
    }
  }

  if (errors.length > 0) {
    return {
      verified: false,
      errors,
      conformance,
      structure,
      delegation,
      reviewerReview,
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
    roles: delegation.roles,
    checks: {
      implementationConformance: "PASS",
      structureValidation: "PASS",
      reviewerReview: reviewerReview.status,
      securityReview: securityReview.status
    },
    commands: {
      structureValidation: structure.command || "npm run check:structure"
    },
    changedFiles: conformance.changedFiles || [],
    sensitiveFiles,
    reviewerReview,
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
    delegation,
    reviewerReview,
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
  parseReviewArtifact,
  parseSecurityReview,
  readDelegation,
  runStructureValidation,
  stableStringify,
  validateVerificationEvidenceGate,
  verifyEvidenceDocument
};
