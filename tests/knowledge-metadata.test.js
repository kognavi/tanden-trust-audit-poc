const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseFrontmatter,
  validateKnowledgeDirectory
} = require("../scripts/validate-knowledge-metadata");

function withKnowledgeDir(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-metadata-"));
  try {
    fs.mkdirSync(path.join(root, "00-inbox"), { recursive: true });
    fs.mkdirSync(path.join(root, "20-research"), { recursive: true });
    fs.mkdirSync(path.join(root, "templates"), { recursive: true });
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeNote(root, relativePath, {
  id,
  type = "research",
  status = "inbox",
  source = [],
  supports = [],
  contradicts = [],
  supersedes = [],
  reviewedBy = []
}) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  const list = (name, values) => {
    if (values.length === 0) return `${name}: []`;
    return `${name}:\n${values.map((value) => `  - ${value}`).join("\n")}`;
  };

  fs.writeFileSync(
    fullPath,
    [
      "---",
      `id: ${id}`,
      `type: ${type}`,
      `status: ${status}`,
      "created: 2026-09-08",
      "updated: 2026-09-08",
      list("source", source),
      list("supports", supports),
      list("contradicts", contradicts),
      list("supersedes", supersedes),
      list("reviewed_by", reviewedBy),
      "---",
      "",
      "# Test note",
      ""
    ].join("\n")
  );
}

test("parseFrontmatter parses scalar and block-list fields", () => {
  const metadata = parseFrontmatter([
    "---",
    "id: note-a",
    "type: research",
    "status: reviewed",
    "source:",
    "  - docs/a.md",
    "supports: []",
    "reviewed_by:",
    "  - codex",
    "---",
    "# Note"
  ].join("\n"));

  assert.equal(metadata.id, "note-a");
  assert.equal(metadata.status, "reviewed");
  assert.deepEqual(metadata.source, ["docs/a.md"]);
  assert.deepEqual(metadata.supports, []);
  assert.deepEqual(metadata.reviewed_by, ["codex"]);
});

test("valid knowledge notes pass including a valid relation", () =>
  withKnowledgeDir((root) => {
    writeNote(root, "00-inbox/a.md", { id: "a" });
    writeNote(root, "20-research/b.md", {
      id: "b",
      status: "reviewed",
      source: ["docs/loop-engineering.md"],
      supports: ["a"],
      reviewedBy: ["codex"]
    });

    const result = validateKnowledgeDirectory(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.notes.length, 2);
  }));

test("invalid status is rejected", () =>
  withKnowledgeDir((root) => {
    writeNote(root, "00-inbox/a.md", { id: "a", status: "done" });
    const result = validateKnowledgeDirectory(root);
    assert.ok(result.errors.some((error) => error.includes("invalid status 'done'")));
  }));

test("duplicate ids are rejected", () =>
  withKnowledgeDir((root) => {
    writeNote(root, "00-inbox/a.md", { id: "same" });
    writeNote(root, "20-research/b.md", { id: "same" });
    const result = validateKnowledgeDirectory(root);
    assert.ok(result.errors.some((error) => error.includes("duplicate id 'same'")));
  }));

test("broken relation target is rejected", () =>
  withKnowledgeDir((root) => {
    writeNote(root, "00-inbox/a.md", { id: "a", supports: ["missing"] });
    const result = validateKnowledgeDirectory(root);
    assert.ok(result.errors.some((error) => error.includes("references unknown note id 'missing'")));
  }));

test("reviewed note requires source and reviewer", () =>
  withKnowledgeDir((root) => {
    writeNote(root, "20-research/a.md", { id: "a", status: "reviewed" });
    const result = validateKnowledgeDirectory(root);
    assert.ok(result.errors.some((error) => error.includes("requires at least one source")));
    assert.ok(result.errors.some((error) => error.includes("requires at least one reviewed_by")));
  }));

test("README and templates are ignored", () =>
  withKnowledgeDir((root) => {
    fs.writeFileSync(path.join(root, "README.md"), "# No frontmatter\n");
    fs.writeFileSync(path.join(root, "templates", "note.md"), "# Template without frontmatter\n");
    writeNote(root, "00-inbox/a.md", { id: "a" });

    const result = validateKnowledgeDirectory(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.notes.length, 1);
  }));
