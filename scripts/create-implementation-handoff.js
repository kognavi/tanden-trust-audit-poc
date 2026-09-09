#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const { validateSpecDirectory } = require("./check-spec-readiness");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function buildHandoffMarkdown({ featureSlug, readiness, date }) {
  const tick = String.fromCharCode(96);
  const branchName = "feature/" + featureSlug;
  const worktreePath = "../worktrees/" + featureSlug;
  const specDir = ".kiro/specs/" + featureSlug;

  return [
    "# Implementation Handoff: " + featureSlug,
    "",
    "## Provenance",
    "",
    "- Source Context Pack: " + tick + readiness.sourceContext + tick,
    "- Context ID: " + tick + readiness.contextId + tick,
    "- Spec directory: " + tick + specDir + tick,
    "- Spec Readiness: PASS",
    "- Generated: " + date,
    "",
    "## Suggested Git Plan",
    "",
    "- Suggested branch: " + tick + branchName + tick,
    "- Suggested worktree: " + tick + worktreePath + tick,
    "",
    "Suggested commands (review before running):",
    "",
    "~~~bash",
    "git status --short",
    "git fetch --prune",
    "git worktree add " + worktreePath + " -b " + branchName + " main",
    "cd " + worktreePath,
    "npm run spec:ready -- " + featureSlug,
    "~~~",
    "",
    "The generator does not execute these commands.",
    "",
    "## Developer Start Checklist",
    "",
    "- [ ] Confirm working tree status is understood before creating a worktree.",
    "- [ ] Re-read repository " + tick + "AGENTS.md" + tick + ".",
    "- [ ] Re-read " + tick + readiness.sourceContext + tick + ".",
    "- [ ] Re-read " + tick + specDir + "/requirements.md" + tick + ".",
    "- [ ] Re-read " + tick + specDir + "/design.md" + tick + ".",
    "- [ ] Confirm " + tick + "npm run spec:ready -- " + featureSlug + tick + " passes in the implementation worktree.",
    "- [ ] Verify current code/tests/module registry before editing.",
    "- [ ] Keep implementation scope minimal and test-backed.",
    "",
    "## PR Provenance",
    "",
    "- Source Context Pack: " + tick + readiness.sourceContext + tick,
    "- Context ID: " + tick + readiness.contextId + tick,
    "- Spec: " + tick + specDir + tick,
    "- Spec Readiness: PASS",
    "- Implementation Handoff: " + tick + specDir + "/implementation-handoff.md" + tick,
    "- Suggested branch: " + tick + branchName + tick,
    "",
    "## Human Approval Reminder",
    "",
    "Production deployment, Terraform destroy, IAM/KMS privilege expansion, security-control removal, public exposure expansion, material recurring cost, or canonical trust-boundary changes still require Human Approval.",
    ""
  ].join("\n");
}

function createImplementationHandoff(repositoryRoot, featureSlug, options = {}) {
  validateFeatureSlug(featureSlug);
  const root = path.resolve(repositoryRoot);
  const readiness = validateSpecDirectory(root, featureSlug);

  if (!readiness.ready) {
    const message = readiness.errors.length
      ? readiness.errors.join("; ")
      : "Spec Readiness Gate failed";
    throw new Error("Spec is not ready: " + message);
  }

  const specDir = path.join(root, ".kiro", "specs", featureSlug);
  const outputPath = path.join(specDir, "implementation-handoff.md");

  if (fs.existsSync(outputPath)) {
    throw new Error("implementation handoff already exists");
  }

  const date = options.date || new Date().toISOString().slice(0, 10);
  const markdown = buildHandoffMarkdown({
    featureSlug,
    readiness,
    date
  });

  fs.writeFileSync(outputPath, markdown, "utf8");

  return {
    outputPath,
    relativeOutputPath: toPosix(path.relative(root, outputPath)),
    branchName: "feature/" + featureSlug,
    worktreePath: "../worktrees/" + featureSlug,
    sourceContext: readiness.sourceContext,
    contextId: readiness.contextId
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const featureSlug = process.argv[2];

  if (!featureSlug) {
    console.error("Usage: node scripts/create-implementation-handoff.js <feature-slug>");
    process.exitCode = 2;
    return;
  }

  try {
    const result = createImplementationHandoff(repositoryRoot, featureSlug);
    console.log("Implementation handoff generated: " + result.relativeOutputPath);
    console.log("- Suggested branch: " + result.branchName);
    console.log("- Suggested worktree: " + result.worktreePath);
    console.log("- Source Context Pack: " + result.sourceContext);
  } catch (error) {
    console.error("Implementation handoff failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  buildHandoffMarkdown,
  createImplementationHandoff
};
