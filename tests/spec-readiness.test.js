const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  findPlaceholders,
  findUncheckedReviewItems,
  findUnresolvedOpenQuestions,
  validateSpecDirectory
} = require("../scripts/check-spec-readiness");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-ready-"));
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
    "Deliver deterministic readiness validation.",
    "",
    "## Current Implementation Truth",
    "",
    "Verified against code, tests, and module registry.",
    "",
    "## Requirements",
    "",
    "- The gate validates all three spec files.",
    "",
    "## Invariants",
    "",
    "- Preserve the repository trust boundary.",
    "",
    "## Acceptance Criteria",
    "",
    "- Gate returns exit 0 only when ready.",
    "",
    "## Open Questions",
    "",
    "None",
    "",
    "## Review Gate",
    "",
    "Architect review complete."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "design.md"), [
    "# feature Design",
    "",
    sourceSection(),
    "## Current State",
    "",
    "Spec scaffold exists.",
    "",
    "## Proposed Design",
    "",
    "Read-only deterministic validator.",
    "",
    "## Affected Components",
    "",
    "- scripts/check-spec-readiness.js",
    "",
    "## Trust Boundary Impact",
    "",
    "- unchanged",
    "",
    "## Security",
    "",
    "- No AWS or credential access.",
    "",
    "## Cost and Operations",
    "",
    "- No recurring cost.",
    "",
    "## Alternatives Considered",
    "",
    "- Manual review only was rejected as insufficiently deterministic.",
    "",
    "## Validation Plan",
    "",
    "- Unit tests and CI.",
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
    "- [ ] Implementation task may remain open after readiness."
  ].join("\n"));
}

test("placeholder detection finds unresolved angle-bracket tokens", () => {
  assert.deepEqual(findPlaceholders("hello <Requirement 1> world"), ["<Requirement 1>"]);
});

test("review checklist detection only inspects Review Checklist section", () => {
  const markdown = [
    "## Tasks",
    "- [ ] implementation task",
    "## Review Checklist",
    "- [ ] review item",
    "- [x] done"
  ].join("\n");
  assert.deepEqual(findUncheckedReviewItems(markdown), ["- [ ] review item"]);
});

test("Open Questions accepts explicit None", () => {
  assert.deepEqual(findUnresolvedOpenQuestions("## Open Questions\n\nNone\n"), []);
  assert.deepEqual(findUnresolvedOpenQuestions("## Open Questions\n\n- Resolved: none\n"), []);
});

test("Open Questions rejects unresolved bullets", () => {
  const result = findUnresolvedOpenQuestions("## Open Questions\n\n- Which API shape?\n");
  assert.equal(result.length, 1);
});

test("ready spec passes", () =>
  fixture((root) => {
    writeReadySpec(root);
    const result = validateSpecDirectory(root, "feature");
    assert.equal(result.ready, true);
    assert.deepEqual(result.errors, []);
  }));

test("placeholder blocks readiness", () =>
  fixture((root) => {
    writeReadySpec(root);
    const file = path.join(root, ".kiro", "specs", "feature", "design.md");
    fs.appendFileSync(file, "\n<Describe design>\n");
    const result = validateSpecDirectory(root, "feature");
    assert.equal(result.ready, false);
    assert.ok(result.errors.some((error) => error.includes("unresolved placeholder")));
  }));

test("unresolved question blocks readiness", () =>
  fixture((root) => {
    writeReadySpec(root);
    const file = path.join(root, ".kiro", "specs", "feature", "requirements.md");
    const content = fs.readFileSync(file, "utf8").replace(
      "## Open Questions\n\nNone",
      "## Open Questions\n\n- Which API shape?"
    );
    fs.writeFileSync(file, content);
    const result = validateSpecDirectory(root, "feature");
    assert.ok(result.errors.some((error) => error.includes("unresolved open question")));
  }));

test("unchecked review checklist blocks readiness", () =>
  fixture((root) => {
    writeReadySpec(root);
    const file = path.join(root, ".kiro", "specs", "feature", "design.md");
    const content = fs.readFileSync(file, "utf8").replace(
      "- [x] Design matches reviewed requirements.",
      "- [ ] Design matches reviewed requirements."
    );
    fs.writeFileSync(file, content);
    const result = validateSpecDirectory(root, "feature");
    assert.ok(result.errors.some((error) => error.includes("unchecked review item")));
  }));

test("mismatched Source Context Pack blocks readiness", () =>
  fixture((root) => {
    writeReadySpec(root);
    const file = path.join(root, ".kiro", "specs", "feature", "tasks.md");
    const content = fs.readFileSync(file, "utf8").replace(
      "feature-context.md",
      "other-context.md"
    );
    fs.writeFileSync(file, content);
    const result = validateSpecDirectory(root, "feature");
    assert.ok(result.errors.some((error) => error.includes("path differs")));
  }));

test("missing required section blocks readiness", () =>
  fixture((root) => {
    writeReadySpec(root);
    const file = path.join(root, ".kiro", "specs", "feature", "design.md");
    const content = fs.readFileSync(file, "utf8").replace("## Security", "## Removed Security");
    fs.writeFileSync(file, content);
    const result = validateSpecDirectory(root, "feature");
    assert.ok(result.errors.some((error) => error.includes("missing required section 'Security'")));
  }));
