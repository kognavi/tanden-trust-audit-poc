const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("AI Development OS required files exist", () => {
  const required = [
    "docs/ai-development-os.md",
    ".codex/config.toml",
    ".kiro/settings/mcp.json",
    ".kiro/agents/architect.md",
    ".kiro/agents/developer.md",
    ".kiro/agents/security-reviewer.md",
    ".kiro/specs/ai-development-os/requirements.md",
    ".kiro/specs/ai-development-os/design.md",
    ".kiro/specs/ai-development-os/tasks.md",
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
