#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const { validateFeatureSlug } = require("./scaffold-spec-from-context");

function normalizeIdentity(value) {
  return String(value || "").trim();
}

function validateDelegationRoles(builder, reviewer, securityReviewer) {
  const errors = [];
  const b = normalizeIdentity(builder);
  const r = normalizeIdentity(reviewer);
  const s = normalizeIdentity(securityReviewer);

  if (!b) errors.push("builder identity is required");
  if (!r) errors.push("reviewer identity is required");
  if (b && r && b === r) errors.push("builder and reviewer identities must differ");
  if (s && b && s === b) errors.push("builder and securityReviewer identities must differ");

  return {
    valid: errors.length === 0,
    errors,
    roles: {
      builder: b || null,
      reviewer: r || null,
      securityReviewer: s || null
    }
  };
}

function createDelegationDocument(featureSlug, builder, reviewer, securityReviewer, now) {
  validateFeatureSlug(featureSlug);
  const validation = validateDelegationRoles(builder, reviewer, securityReviewer);
  if (!validation.valid) {
    const error = new Error(validation.errors.join("; "));
    error.validationErrors = validation.errors;
    throw error;
  }

  return {
    schemaVersion: 1,
    feature: featureSlug,
    generatedAt: now || new Date().toISOString(),
    roles: validation.roles
  };
}

function writeDelegation(repositoryRoot, featureSlug, builder, reviewer, securityReviewer, options = {}) {
  const root = path.resolve(repositoryRoot);
  const specDir = path.join(root, ".kiro", "specs", featureSlug);
  if (!fs.existsSync(specDir)) {
    throw new Error("feature spec directory does not exist: " + featureSlug);
  }

  const document = createDelegationDocument(
    featureSlug,
    builder,
    reviewer,
    securityReviewer,
    options.now
  );
  const outputPath = path.join(specDir, "agent-delegation.json");
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2) + "\n");

  return { document, outputPath };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const [featureSlug, builder, reviewer, securityReviewer] = process.argv.slice(2);

  if (!featureSlug || !builder || !reviewer) {
    console.error(
      "Usage: node scripts/create-agent-delegation.js <feature-slug> <builder-id> <reviewer-id> [security-reviewer-id]"
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = writeDelegation(
      repositoryRoot,
      featureSlug,
      builder,
      reviewer,
      securityReviewer
    );
    console.log("Agent delegation created: " + path.relative(repositoryRoot, result.outputPath));
    console.log("- Builder: " + result.document.roles.builder);
    console.log("- Reviewer: " + result.document.roles.reviewer);
    console.log("- Security Reviewer: " + (result.document.roles.securityReviewer || "N/A"));
  } catch (error) {
    console.error("Agent delegation failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  createDelegationDocument,
  normalizeIdentity,
  validateDelegationRoles,
  writeDelegation
};
