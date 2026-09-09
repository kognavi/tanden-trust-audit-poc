const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("AI Development OS required files exist", () => {
  const required = [
    "docs/ai-development-os.md",
    "docs/loop-engineering.md",
    "docs/context-to-spec-handoff.md",
    "docs/spec-readiness-gate.md",
    "docs/implementation-handoff.md",
    "docs/implementation-conformance-gate.md",
    "docs/verification-evidence-gate.md",
    "docs/multi-agent-delegation.md",
    "docs/agent-orchestrator-task-graph.md",
    ".codex/config.toml",
    ".kiro/settings/mcp.json",
    ".kiro/agents/architect.md",
    ".kiro/agents/developer.md",
    ".kiro/agents/reviewer.md",
    ".kiro/agents/security-reviewer.md",
    ".kiro/specs/ai-development-os/requirements.md",
    ".kiro/specs/ai-development-os/design.md",
    ".kiro/specs/ai-development-os/tasks.md",
    ".kiro/specs/loop-engineering/requirements.md",
    ".kiro/specs/loop-engineering/design.md",
    ".kiro/specs/loop-engineering/tasks.md",
    "knowledge/README.md",
    "knowledge/00-inbox/README.md",
    "knowledge/10-decisions/README.md",
    "knowledge/20-research/README.md",
    "knowledge/30-learnings/README.md",
    "knowledge/90-archive/README.md",
    "knowledge/templates/note.md",
    "infra/AGENTS.md"
  ];
  for (const relativePath of required) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `missing AI Development OS file: ${relativePath}`);
  }
});

test("Kiro and Codex skills stay synchronized", () => {
  for (const skill of ["architecture-review", "aws-security-review", "testing", "pr-review"]) {
    assert.equal(read(`.kiro/skills/${skill}/SKILL.md`), read(`.agents/skills/${skill}/SKILL.md`), `skill drift: ${skill}`);
  }
});

test("workspace MCP configuration is portable", () => {
  const config = JSON.parse(read(".kiro/settings/mcp.json"));
  const semgrep = config.mcpServers?.semgrep;
  assert.ok(semgrep);
  assert.equal(path.isAbsolute(semgrep.command), false);
  for (const arg of semgrep.args || []) assert.equal(path.isAbsolute(arg), false);
});

test("Codex uses approval and sandbox defaults", () => {
  const config = read(".codex/config.toml");
  assert.match(config, /approval_policy\s*=\s*"on-request"/);
  assert.match(config, /sandbox_mode\s*=\s*"workspace-write"/);
  assert.match(config, /network_access\s*=\s*false/);
});

test("knowledge note template exposes controlled relation metadata", () => {
  const template = read("knowledge/templates/note.md");
  for (const field of ["status:", "source:", "supports:", "contradicts:", "supersedes:", "reviewed_by:"]) {
    assert.match(template, new RegExp(`^\\s*${field.replace(":", "\\:")}`, "m"), `missing knowledge metadata field: ${field}`);
  }
});

test("loop engineering keeps repository trust boundary explicit", () => {
  const docs = read("docs/loop-engineering.md");
  assert.match(docs, /Evidence → Schema → Sign → Store → Ledger/);
  assert.match(docs, /git worktree/);
  assert.match(docs, /Human approval/i);
});

test("Context Pack to Spec handoff stays wired into agent governance", () => {
  const rootAgents = read("AGENTS.md");
  const architect = read(".kiro/agents/architect.md");
  const developer = read(".kiro/agents/developer.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["spec:scaffold"], "node scripts/scaffold-spec-from-context.js");
  assert.match(rootAgents, /Context Pack/);
  assert.match(rootAgents, /spec:scaffold/);
  assert.match(architect, /source Context Pack/i);
  assert.match(developer, /Source Context Pack/i);
});

test("Spec Readiness Gate stays wired into implementation governance", () => {
  const rootAgents = read("AGENTS.md");
  const architect = read(".kiro/agents/architect.md");
  const developer = read(".kiro/agents/developer.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["spec:ready"], "node scripts/check-spec-readiness.js");
  assert.match(rootAgents, /spec:ready/);
  assert.match(architect, /Spec Readiness Gate/);
  assert.match(developer, /spec:ready/);
});

test("Implementation Handoff stays wired into developer and PR governance", () => {
  const rootAgents = read("AGENTS.md");
  const developer = read(".kiro/agents/developer.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["impl:handoff"], "node scripts/create-implementation-handoff.js");
  assert.match(rootAgents, /impl:handoff/);
  assert.match(developer, /Implementation Handoff/);
});

test("PR template carries implementation provenance fields", () => {
  const template = read(".github/pull_request_template.md");
  for (const label of [
    "Source Context Pack",
    "Context ID",
    "Spec",
    "Spec Readiness",
    "Implementation Handoff",
    "Branch / Worktree"
  ]) {
    assert.match(template, new RegExp(label));
  }
});

test("Implementation Conformance Gate stays wired into PR governance", () => {
  const rootAgents = read("AGENTS.md");
  const developer = read(".kiro/agents/developer.md");
  const template = read(".github/pull_request_template.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["impl:conform"], "node scripts/check-implementation-conformance.js");
  assert.match(rootAgents, /impl:conform/);
  assert.match(developer, /Implementation Conformance Gate/);
  assert.match(template, /Conformance Gate/);
});

test("Verification & Evidence Gate stays wired into merge governance", () => {
  const rootAgents = read("AGENTS.md");
  const developer = read(".kiro/agents/developer.md");
  const template = read(".github/pull_request_template.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["verify:gate"], "node scripts/run-verification-evidence-gate.js");
  assert.match(rootAgents, /verify:gate/);
  assert.match(developer, /Verification & Evidence Gate/);
  assert.match(template, /Verification Evidence/);
  assert.match(template, /Evidence Digest/);
});


test("Multi-Agent Delegation stays wired into verification governance", () => {
  const rootAgents = read("AGENTS.md");
  const developer = read(".kiro/agents/developer.md");
  const reviewer = read(".kiro/agents/reviewer.md");
  const securityReviewer = read(".kiro/agents/security-reviewer.md");
  const template = read(".github/pull_request_template.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["agent:delegate"], "node scripts/create-agent-delegation.js");
  assert.match(rootAgents, /agent:delegate/);
  assert.match(rootAgents, /BuilderとReviewer/);
  assert.match(developer, /Multi-Agent Delegation/);
  assert.match(reviewer, /independent challenger/i);
  assert.match(securityReviewer, /agent-delegation\.json/);
  assert.match(template, /Agent Delegation/);
  assert.match(template, /Security Reviewer/);
});


test("Agent Orchestrator Task Graph stays wired into workflow governance", () => {
  const rootAgents = read("AGENTS.md");
  const developer = read(".kiro/agents/developer.md");
  const reviewer = read(".kiro/agents/reviewer.md");
  const securityReviewer = read(".kiro/agents/security-reviewer.md");
  const template = read(".github/pull_request_template.md");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(pkg.scripts["agent:graph:init"], "node scripts/agent-task-graph.js init");
  assert.equal(pkg.scripts["agent:graph:event"], "node scripts/agent-task-graph.js event");
  assert.match(rootAgents, /agent:graph:init/);
  assert.match(rootAgents, /FAILED terminal state/);
  assert.match(developer, /Agent Orchestrator \/ Task Graph/);
  assert.match(reviewer, /Reviewer task is `READY`/);
  assert.match(securityReviewer, /Security Reviewer task is `READY`/);
  assert.match(template, /Agent Task Graph/);
  assert.match(template, /Retry Count/);
});
