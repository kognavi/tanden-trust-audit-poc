const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  isSensitivePath,
  parseAffectedComponents,
  pathAllowed,
  validateImplementationConformance
} = require("../scripts/check-implementation-conformance");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "impl-conformance-"));
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
    "# feature Requirements", "", sourceSection(),
    "## Purpose", "", "Conformance gate.",
    "", "## Current Implementation Truth", "", "Verified.",
    "", "## Requirements", "", "- Check changed paths.",
    "", "## Invariants", "", "- Preserve trust boundary.",
    "", "## Acceptance Criteria", "", "- Out-of-scope file fails.",
    "", "## Open Questions", "", "None",
    "", "## Review Gate", "", "Reviewed."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "design.md"), [
    "# feature Design", "", sourceSection(),
    "## Current State", "", "Implementation handoff exists.",
    "", "## Proposed Design", "", "Compare changed files to Affected Components.",
    "", "## Affected Components", "",
    "- `lib/feature.js`",
    "- `tests/feature.test.js`",
    "- `docs/`",
    "", "## Trust Boundary Impact", "", "- unchanged",
    "", "## Security", "", "- no new IAM/KMS access",
    "", "## Cost and Operations", "", "- no recurring cost",
    "", "## Alternatives Considered", "", "- semantic AI judge rejected",
    "", "## Validation Plan", "", "- deterministic tests",
    "", "## Review Checklist", "",
    "- [x] Design matches reviewed requirements.",
    "- [x] Current-state claims were checked against code/tests/module registry.",
    "- [x] Trust boundary impact is explicit.",
    "- [x] Security/cost/operations are explicit.",
    "- [x] Human Approval identified where required."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "tasks.md"), [
    "# feature Tasks", "", sourceSection(), "- [ ] Implement feature."
  ].join("\n"));

  fs.writeFileSync(path.join(dir, "implementation-handoff.md"), [
    "# Implementation Handoff: feature", "",
    "## Provenance", "",
    "- Source Context Pack: `knowledge/20-research/context-packs/feature-context.md`",
    "- Context ID: `context-pack-feature`",
    "- Spec directory: `.kiro/specs/feature`",
    "- Spec Readiness: PASS"
  ].join("\n"));
}

test("parseAffectedComponents extracts exact files and prefixes", () => {
  const design = [
    "## Affected Components", "",
    "- `lib/a.js`",
    "- `tests/`",
    "- not-a-path"
  ].join("\n");
  assert.deepEqual(parseAffectedComponents(design), ["lib/a.js", "tests/"]);
});

test("pathAllowed supports exact path, prefix and governance paths", () => {
  const allowed = ["lib/a.js", "tests/"];
  assert.equal(pathAllowed("lib/a.js", allowed, "feature"), true);
  assert.equal(pathAllowed("tests/a.test.js", allowed, "feature"), true);
  assert.equal(pathAllowed("lib/b.js", allowed, "feature"), false);
  assert.equal(pathAllowed(".kiro/specs/feature/tasks.md", allowed, "feature"), true);
  assert.equal(pathAllowed("knowledge/30-learnings/feature.md", allowed, "feature"), true);
});

test("sensitive paths are detected", () => {
  assert.equal(isSensitivePath("infra/main.tf"), true);
  assert.equal(isSensitivePath(".github/workflows/ci.yml"), true);
  assert.equal(isSensitivePath("lib/kms-client.js"), true);
  assert.equal(isSensitivePath("lib/feature.js"), false);
});

test("conformant changed files pass", () =>
  fixture((root) => {
    writeReadySpec(root);
    const result = validateImplementationConformance(root, "feature", {
      changedFiles: [
        "lib/feature.js",
        "tests/feature.test.js",
        ".kiro/specs/feature/tasks.md",
        "knowledge/30-learnings/feature.md"
      ]
    });
    assert.equal(result.conformant, true);
    assert.deepEqual(result.errors, []);
  }));

test("out-of-scope changed file fails", () =>
  fixture((root) => {
    writeReadySpec(root);
    const result = validateImplementationConformance(root, "feature", {
      changedFiles: ["lib/unplanned.js"]
    });
    assert.equal(result.conformant, false);
    assert.ok(result.errors.some((error) => error.includes("outside Spec Affected Components")));
  }));

test("provenance mismatch fails", () =>
  fixture((root) => {
    writeReadySpec(root);
    const handoff = path.join(root, ".kiro", "specs", "feature", "implementation-handoff.md");
    const content = fs.readFileSync(handoff, "utf8").replace("context-pack-feature", "other-context");
    fs.writeFileSync(handoff, content);
    const result = validateImplementationConformance(root, "feature", {
      changedFiles: ["lib/feature.js"]
    });
    assert.ok(result.errors.some((error) => error.includes("Context ID differs")));
  }));

test("missing implementation handoff fails", () =>
  fixture((root) => {
    writeReadySpec(root);
    fs.unlinkSync(path.join(root, ".kiro", "specs", "feature", "implementation-handoff.md"));
    const result = validateImplementationConformance(root, "feature", {
      changedFiles: ["lib/feature.js"]
    });
    assert.ok(result.errors.some((error) => error.includes("implementation-handoff")));
  }));


test("parseAffectedComponents accepts extensionless dotfiles", () => {
  const markdown = [
    "# Design",
    "",
    "## Affected Components",
    "- `.gitignore`",
    "- `.npmrc`"
  ].join("\n");

  assert.deepEqual(parseAffectedComponents(markdown), [".gitignore", ".npmrc"]);
});
