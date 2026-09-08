const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  assertInsideRepository,
  buildContextPack,
  extractTokens,
  generateContextPack,
  rankRelatedFiles
} = require("../scripts/generate-context-pack");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "context-pack-"));
  try {
    fs.mkdirSync(path.join(root, "knowledge", "00-inbox"), { recursive: true });
    fs.mkdirSync(path.join(root, "knowledge", "20-research"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, "lib"), { recursive: true });
    fs.mkdirSync(path.join(root, "tests"), { recursive: true });
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# Rules\nEvidence -> Schema -> Sign -> Store -> Ledger\n");
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeInbox(root) {
  const target = path.join(root, "knowledge", "00-inbox", "export-evidence.md");
  fs.writeFileSync(target, [
    "---",
    "id: export-evidence",
    "type: idea",
    "status: inbox",
    "created: 2026-09-08",
    "updated: 2026-09-08",
    "source: []",
    "supports: []",
    "contradicts: []",
    "supersedes: []",
    "reviewed_by: []",
    "---",
    "",
    "# Export Evidence",
    "Add evidence export verification with sidecar audit metadata."
  ].join("\n"));
  return target;
}

test("extractTokens keeps technical words and removes common noise", () => {
  const tokens = extractTokens("GitHub repository Context Pack evidence sidecar verification");
  assert.ok(tokens.includes("evidence"));
  assert.ok(tokens.includes("sidecar"));
  assert.ok(tokens.includes("verification"));
  assert.equal(tokens.includes("repository"), false);
});

test("assertInsideRepository rejects traversal outside root", () =>
  fixture((root) => {
    assert.throws(
      () => assertInsideRepository(root, path.join(root, "..", "outside.md")),
      /inside repository root/
    );
  }));

test("ranking always includes AGENTS and favors relevant files", () =>
  fixture((root) => {
    const inbox = writeInbox(root);
    fs.writeFileSync(path.join(root, "docs", "export.md"), "evidence export sidecar verification");
    fs.writeFileSync(path.join(root, "lib", "unrelated.js"), "const x = 1;");

    const ranked = rankRelatedFiles(root, inbox, 10);
    assert.equal(ranked[0].path, "AGENTS.md");
    assert.ok(ranked.some((item) => item.path === "docs/export.md"));
    assert.equal(ranked.some((item) => item.path === "lib/unrelated.js"), false);
  }));

test("buildContextPack creates validator-compatible metadata shape", () =>
  fixture((root) => {
    const inbox = writeInbox(root);
    const markdown = buildContextPack({
      repositoryRoot: root,
      inputPath: inbox,
      rankedFiles: [
        { path: "AGENTS.md", score: 1000 },
        { path: "docs/export.md", score: 8 }
      ],
      date: "2026-09-08"
    });

    assert.match(markdown, /^---\nid: context-pack-export-evidence/m);
    assert.match(markdown, /status: draft/);
    assert.match(markdown, /supports:\n  - export-evidence/);
    assert.match(markdown, /docs\/export\.md/);
  }));

test("generateContextPack writes under knowledge context-packs directory", () =>
  fixture((root) => {
    writeInbox(root);
    fs.writeFileSync(path.join(root, "docs", "export.md"), "evidence export sidecar verification");

    const result = generateContextPack(root, "knowledge/00-inbox/export-evidence.md", {
      date: "2026-09-08"
    });

    assert.equal(
      result.relativeOutputPath,
      "knowledge/20-research/context-packs/export-evidence-context.md"
    );
    assert.equal(fs.existsSync(result.outputPath), true);
  }));
