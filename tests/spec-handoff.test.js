const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createSpecScaffold,
  readContextPack,
  validateFeatureSlug
} = require("../scripts/scaffold-spec-from-context");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-handoff-"));
  try {
    fs.mkdirSync(path.join(root, ".kiro", "specs"), { recursive: true });
    fs.mkdirSync(path.join(root, "knowledge", "20-research", "context-packs"), { recursive: true });
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeContextPack(root, overrides = {}) {
  const target = path.join(root, "knowledge", "20-research", "context-packs", "feature-context.md");
  fs.writeFileSync(target, [
    "---",
    "id: " + (overrides.id || "context-pack-feature"),
    "type: " + (overrides.type || "context-pack"),
    "status: draft",
    "created: 2026-09-09",
    "updated: 2026-09-09",
    "source: []",
    "supports: []",
    "contradicts: []",
    "supersedes: []",
    "reviewed_by: []",
    "---",
    "",
    "# Context Pack"
  ].join("\n"));
  return target;
}

test("feature slug validation accepts safe slugs", () => {
  assert.equal(validateFeatureSlug("context-to-spec"), "context-to-spec");
  assert.equal(validateFeatureSlug("feature123"), "feature123");
});

test("feature slug validation rejects unsafe values", () => {
  for (const value of ["../escape", "Feature", "bad_slug", "-bad", ""]) {
    assert.throws(() => validateFeatureSlug(value), /feature slug/);
  }
});

test("readContextPack requires context-pack type", () =>
  fixture((root) => {
    const file = writeContextPack(root, { type: "research" });
    assert.throws(() => readContextPack(root, file), /context-pack note/);
  }));

test("createSpecScaffold writes three source-linked files", () =>
  fixture((root) => {
    writeContextPack(root);
    const result = createSpecScaffold(
      root,
      "knowledge/20-research/context-packs/feature-context.md",
      "my-feature"
    );

    assert.equal(result.relativeSpecDir, ".kiro/specs/my-feature");
    assert.deepEqual(result.files.sort(), [
      ".kiro/specs/my-feature/design.md",
      ".kiro/specs/my-feature/requirements.md",
      ".kiro/specs/my-feature/tasks.md"
    ]);

    const requirements = fs.readFileSync(path.join(root, ".kiro/specs/my-feature/requirements.md"), "utf8");
    assert.match(requirements, /knowledge\/20-research\/context-packs\/feature-context\.md/);
    assert.match(requirements, /Context ID: .*context-pack-feature/);
    assert.match(requirements, /Evidence → Schema → Sign → Store → Ledger/);
  }));

test("existing spec directory is not overwritten", () =>
  fixture((root) => {
    writeContextPack(root);
    fs.mkdirSync(path.join(root, ".kiro", "specs", "existing"));

    assert.throws(
      () => createSpecScaffold(
        root,
        "knowledge/20-research/context-packs/feature-context.md",
        "existing"
      ),
      /already exists/
    );
  }));
