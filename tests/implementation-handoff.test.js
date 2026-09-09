const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildHandoffMarkdown,
  createImplementationHandoff
} = require("../scripts/create-implementation-handoff");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "impl-handoff-"));
  try {
    fs.mkdirSync(path.join(root, ".kiro", "specs", "feature"), { recursive: true });
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function sourceSection() {
  const tick = String.fromCharCode(96);
  return [
    "## Source Context Pack",
    "",
    "- " + tick + "knowledge/20-research/context-packs/feature-context.md" + tick,
    "- Context ID: " + tick + "context-pack-feature" + tick,
    ""
  ].join("\n");
}

function writeReadySpec(root) {
  const dir = path.join(root, ".kiro", "specs", "feature");

  fs.writeFileSync(path.join(dir, "requirements.md"), [
    "# feature Requirements",
    "",
    sourceSection(),
    "## Purpose",
    "",
    "Implement a safe handoff.",
    "",
    "## Current Implementation Truth",
    "",
    "Verified.",
    "",
    "## Requirements",
    "",
    "- Handoff must preserve provenance.",
    "",
    "## Invariants",
    "",
    "- Preserve trust boundary.",
    "",
    "## Acceptance Criteria",
    "",
    "- Handoff file is generated.",
    "",
    "## Open Questions",
    "",
    "None",
    "",
    "## Review Gate",
    "",
    "Reviewed."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "design.md"), [
    "# feature Design",
    "",
    sourceSection(),
    "## Current State",
    "",
    "Spec is ready.",
    "",
    "## Proposed Design",
    "",
    "Generate a Markdown handoff manifest.",
    "",
    "## Affected Components",
    "",
    "- scripts/create-implementation-handoff.js",
    "",
    "## Trust Boundary Impact",
    "",
    "- unchanged",
    "",
    "## Security",
    "",
    "- no credential access",
    "",
    "## Cost and Operations",
    "",
    "- no recurring cost",
    "",
    "## Alternatives Considered",
    "",
    "- automatic git execution rejected",
    "",
    "## Validation Plan",
    "",
    "- unit tests",
    "",
    "## Review Checklist",
    "",
    "- [x] Design matches reviewed requirements.",
    "- [x] Current-state claims were checked against code/tests/module registry.",
    "- [x] Trust boundary impact is explicit.",
    "- [x] Security/cost/operations are explicit.",
    "- [x] Human Approval identified where required."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "tasks.md"), [
    "# feature Tasks",
    "",
    sourceSection(),
    "- [ ] Implement feature."
  ].join("\n"));
}

test("buildHandoffMarkdown preserves provenance and suggested git plan", () => {
  const markdown = buildHandoffMarkdown({
    featureSlug: "feature",
    readiness: {
      sourceContext: "knowledge/20-research/context-packs/feature-context.md",
      contextId: "context-pack-feature"
    },
    date: "2026-09-09"
  });

  assert.match(markdown, /Source Context Pack/);
  assert.match(markdown, /context-pack-feature/);
  assert.match(markdown, /feature\/feature/);
  assert.match(markdown, /\.\.\/worktrees\/feature/);
  assert.match(markdown, /does not execute these commands/);
});

test("ready spec creates implementation handoff", () =>
  fixture((root) => {
    writeReadySpec(root);
    const result = createImplementationHandoff(root, "feature", { date: "2026-09-09" });

    assert.equal(
      result.relativeOutputPath,
      ".kiro/specs/feature/implementation-handoff.md"
    );
    assert.equal(result.branchName, "feature/feature");
    assert.equal(fs.existsSync(result.outputPath), true);
  }));

test("not-ready spec is rejected", () =>
  fixture((root) => {
    writeReadySpec(root);
    const design = path.join(root, ".kiro", "specs", "feature", "design.md");
    fs.appendFileSync(design, "\n<unfinished>\n");

    assert.throws(
      () => createImplementationHandoff(root, "feature"),
      /Spec is not ready/
    );
  }));

test("existing handoff is not overwritten", () =>
  fixture((root) => {
    writeReadySpec(root);
    const handoff = path.join(root, ".kiro", "specs", "feature", "implementation-handoff.md");
    fs.writeFileSync(handoff, "existing");

    assert.throws(
      () => createImplementationHandoff(root, "feature"),
      /already exists/
    );
    assert.equal(fs.readFileSync(handoff, "utf8"), "existing");
  }));
