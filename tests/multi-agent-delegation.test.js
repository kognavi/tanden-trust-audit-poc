const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createDelegationDocument,
  validateDelegationRoles,
  writeDelegation
} = require("../scripts/create-agent-delegation");

test("distinct builder and reviewer are accepted", () => {
  const result = validateDelegationRoles("codex-builder", "codex-reviewer", "");
  assert.equal(result.valid, true);
  assert.deepEqual(result.roles, {
    builder: "codex-builder",
    reviewer: "codex-reviewer",
    securityReviewer: null
  });
});

test("builder cannot review own work", () => {
  const result = validateDelegationRoles("same-agent", "same-agent", "");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must differ")));
});

test("builder cannot be security reviewer", () => {
  const result = validateDelegationRoles("builder", "reviewer", "builder");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("securityReviewer")));
});

test("delegation document records role provenance", () => {
  const document = createDelegationDocument(
    "feature",
    "builder-a",
    "reviewer-b",
    "security-c",
    "2026-09-09T00:00:00.000Z"
  );
  assert.equal(document.feature, "feature");
  assert.equal(document.roles.builder, "builder-a");
  assert.equal(document.roles.reviewer, "reviewer-b");
  assert.equal(document.roles.securityReviewer, "security-c");
});

test("writeDelegation writes to feature spec directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-delegation-"));
  try {
    fs.mkdirSync(path.join(root, ".kiro", "specs", "feature"), { recursive: true });
    const result = writeDelegation(root, "feature", "builder-a", "reviewer-b", null, {
      now: "2026-09-09T00:00:00.000Z"
    });
    assert.equal(fs.existsSync(result.outputPath), true);
    const parsed = JSON.parse(fs.readFileSync(result.outputPath, "utf8"));
    assert.equal(parsed.roles.reviewer, "reviewer-b");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
