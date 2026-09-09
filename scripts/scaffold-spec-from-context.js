#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { parseFrontmatter } = require("./validate-knowledge-metadata");

const FEATURE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TICK = String.fromCharCode(96);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function assertInsideRepository(repositoryRoot, candidatePath) {
  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(candidatePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("path must stay inside repository root");
  }
  return resolved;
}

function validateFeatureSlug(featureSlug) {
  if (!FEATURE_SLUG_PATTERN.test(featureSlug)) {
    throw new Error("feature slug must match [a-z0-9][a-z0-9-]*");
  }
  return featureSlug;
}

function readContextPack(repositoryRoot, contextPackPath) {
  const root = path.resolve(repositoryRoot);
  const resolved = assertInsideRepository(root, path.resolve(root, contextPackPath));
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("Context Pack file does not exist");
  }

  const content = fs.readFileSync(resolved, "utf8");
  const metadata = parseFrontmatter(content);
  if (metadata.type !== "context-pack") {
    throw new Error("input must be a context-pack note");
  }
  if (!metadata.id) {
    throw new Error("Context Pack must have an id");
  }

  return {
    path: resolved,
    relativePath: toPosix(path.relative(root, resolved)),
    metadata,
    content
  };
}

function buildRequirements(featureSlug, contextPack) {
  return [
    "# " + featureSlug + " Requirements",
    "",
    "## Source Context Pack",
    "",
    "- " + TICK + contextPack.relativePath + TICK,
    "- Context ID: " + TICK + contextPack.metadata.id + TICK,
    "",
    "## Purpose",
    "",
    "<Define the user/business/technical outcome this feature must achieve.>",
    "",
    "## Current Implementation Truth",
    "",
    "- Confirm current behavior against code, tests, and " + TICK + "docs/module-registry.md" + TICK + ".",
    "- Treat the Context Pack as supporting context, not implementation truth.",
    "",
    "## Requirements",
    "",
    "- [ ] <Requirement 1>",
    "- [ ] <Requirement 2>",
    "- [ ] <Requirement 3>",
    "",
    "## Invariants",
    "",
    "- Preserve " + TICK + "Evidence → Schema → Sign → Store → Ledger" + TICK + " unless explicitly approved as an architecture change.",
    "- Do not bypass schema validation, signing, storage, or ledger boundaries.",
    "- Do not weaken security controls to make implementation easier.",
    "- Keep Local-first / AWS-on-demand unless a reviewed requirement justifies otherwise.",
    "",
    "## Acceptance Criteria",
    "",
    "- [ ] Existing relevant tests remain green.",
    "- [ ] New behavior has deterministic tests.",
    "- [ ] Security-sensitive changes receive independent review.",
    "- [ ] Cost/operational impact is documented.",
    "",
    "## Open Questions",
    "",
    "- <Question 1>",
    "",
    "## Review Gate",
    "",
    "This scaffold is not an approved specification until Kiro/Codex review the Context Pack, relevant code/tests/module registry, and a Human approves material architecture/security/cost changes.",
    ""
  ].join("\n");
}

function buildDesign(featureSlug, contextPack) {
  return [
    "# " + featureSlug + " Design",
    "",
    "## Source Context Pack",
    "",
    "- " + TICK + contextPack.relativePath + TICK,
    "- Context ID: " + TICK + contextPack.metadata.id + TICK,
    "",
    "## Current State",
    "",
    "<Summarize verified current implementation from code/tests/module registry.>",
    "",
    "## Proposed Design",
    "",
    "<Describe the smallest design that satisfies the reviewed requirements.>",
    "",
    "## Affected Components",
    "",
    "- <Component / file / module>",
    "",
    "## Trust Boundary Impact",
    "",
    "- " + TICK + "Evidence → Schema → Sign → Store → Ledger" + TICK + ": <unchanged / explain reviewed impact>",
    "",
    "## Security",
    "",
    "- IAM / KMS impact: <none / explain>",
    "- Secret / PII impact: <none / explain>",
    "- Auditability impact: <none / explain>",
    "",
    "## Cost and Operations",
    "",
    "- AWS resource impact: <none / explain>",
    "- Recurring cost impact: <none / explain>",
    "- Operational burden: <none / explain>",
    "",
    "## Alternatives Considered",
    "",
    "- <Alternative 1 and why rejected>",
    "",
    "## Validation Plan",
    "",
    "- Existing tests:",
    "- New tests:",
    "- Security checks:",
    "",
    "## Review Checklist",
    "",
    "- [ ] Design matches reviewed requirements.",
    "- [ ] Current-state claims were checked against code/tests/module registry.",
    "- [ ] Trust boundary impact is explicit.",
    "- [ ] Security/cost/operations are explicit.",
    "- [ ] Human Approval identified where required.",
    ""
  ].join("\n");
}

function buildTasks(featureSlug, contextPack) {
  return [
    "# " + featureSlug + " Tasks",
    "",
    "## Source Context Pack",
    "",
    "- " + TICK + contextPack.relativePath + TICK,
    "- Context ID: " + TICK + contextPack.metadata.id + TICK,
    "",
    "- [ ] Re-read Context Pack and repository " + TICK + "AGENTS.md" + TICK + ".",
    "- [ ] Verify current code/tests/module registry related to the feature.",
    "- [ ] Review and finalize " + TICK + "requirements.md" + TICK + ".",
    "- [ ] Review and finalize " + TICK + "design.md" + TICK + ".",
    "- [ ] Identify minimal implementation scope.",
    "- [ ] Implement the smallest safe change.",
    "- [ ] Add or update deterministic tests.",
    "- [ ] Run " + TICK + "npm run check:structure" + TICK + ".",
    "- [ ] Run relevant security checks.",
    "- [ ] Perform independent diff review.",
    "- [ ] Record reusable learning in " + TICK + "knowledge/30-learnings/" + TICK + ".",
    "- [ ] Open PR and keep material architecture/security/cost changes behind Human Approval.",
    ""
  ].join("\n");
}

function createSpecScaffold(repositoryRoot, contextPackPath, featureSlug) {
  const root = path.resolve(repositoryRoot);
  validateFeatureSlug(featureSlug);
  const contextPack = readContextPack(root, contextPackPath);

  const specDir = assertInsideRepository(root, path.join(root, ".kiro", "specs", featureSlug));
  if (fs.existsSync(specDir)) {
    throw new Error("target spec directory already exists");
  }

  fs.mkdirSync(specDir, { recursive: false });

  const files = {
    "requirements.md": buildRequirements(featureSlug, contextPack),
    "design.md": buildDesign(featureSlug, contextPack),
    "tasks.md": buildTasks(featureSlug, contextPack)
  };

  for (const name of Object.keys(files)) {
    fs.writeFileSync(path.join(specDir, name), files[name], "utf8");
  }

  return {
    specDir,
    relativeSpecDir: toPosix(path.relative(root, specDir)),
    files: Object.keys(files).map((name) => toPosix(path.join(path.relative(root, specDir), name)))
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const contextPackPath = process.argv[2];
  const featureSlug = process.argv[3];

  if (!contextPackPath || !featureSlug) {
    console.error("Usage: node scripts/scaffold-spec-from-context.js <context-pack-path> <feature-slug>");
    process.exitCode = 2;
    return;
  }

  try {
    const result = createSpecScaffold(repositoryRoot, contextPackPath, featureSlug);
    console.log("Spec scaffold generated: " + result.relativeSpecDir);
    for (const file of result.files) console.log("- " + file);
  } catch (error) {
    console.error("Spec scaffold generation failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  FEATURE_SLUG_PATTERN,
  assertInsideRepository,
  buildDesign,
  buildRequirements,
  buildTasks,
  createSpecScaffold,
  readContextPack,
  validateFeatureSlug
};
