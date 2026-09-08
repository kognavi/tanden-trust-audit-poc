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
    ".codex/config.toml",
    ".kiro/settings/mcp.json",
    ".kiro/agents/architect.md",
    ".kiro/agents/developer.md",
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
