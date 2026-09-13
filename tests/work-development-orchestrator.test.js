const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { applyEvent } = require("../scripts/agent-task-graph");
const { createEvidenceDocument } = require("../scripts/run-verification-evidence-gate");
const {
  bootstrapWorkOrchestration,
  getWorkOrchestrationStatus
} = require("../scripts/work-development-orchestrator");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "work-orchestrator-"));
  const feature = options.feature || "feature";
  const context = "knowledge/20-research/context-packs/feature-context.md";
  const contextId = "context-pack-feature";
  const specDir = path.join(root, ".kiro", "specs", feature);
  const source = [
    "## Source Context Pack",
    "",
    "- `" + context + "`",
    "- Context ID: `" + contextId + "`",
    ""
  ].join("\n");

  write(path.join(specDir, "requirements.md"), [
    "# Requirements", "", source,
    "## Purpose", "", "Purpose.", "",
    "## Current Implementation Truth", "", "Current.", "",
    "## Requirements", "", "- [x] Requirement.", "",
    "## Invariants", "", "- Invariant.", "",
    "## Acceptance Criteria", "", "- [x] Accepted.", "",
    "## Open Questions", "", "None.", "",
    "## Review Gate", "", "Ready.", ""
  ].join("\n"));

  const affected = options.affected || "scripts/example.js";
  write(path.join(specDir, "design.md"), [
    "# Design", "", source,
    "## Current State", "", "Current.", "",
    "## Proposed Design", "", "Proposed.", "",
    "## Affected Components", "", "- `" + affected + "`", "",
    "## Trust Boundary Impact", "", "- Unchanged.", "",
    "## Security", "", "- No impact.", "",
    "## Cost and Operations", "", "- No impact.", "",
    "## Alternatives Considered", "", "- Manual flow rejected.", "",
    "## Validation Plan", "", "- Tests.", "",
    "## Review Checklist", "", "- [x] Reviewed.", ""
  ].join("\n"));

  write(path.join(specDir, "tasks.md"), ["# Tasks", "", source, "- [ ] Implement.", ""].join("\n"));
  write(path.join(specDir, "implementation-handoff.md"), [
    "# Implementation Handoff: " + feature, "",
    "## Provenance", "",
    "- Source Context Pack: `" + context + "`",
    "- Context ID: `" + contextId + "`",
    "- Spec directory: `.kiro/specs/" + feature + "`",
    "- Spec Readiness: PASS", ""
  ].join("\n"));

  return { root, feature, specDir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("status reports ready-to-bootstrap after reviewed Handoff", () => {
  const fixture = createFixture();
  try {
    const status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.status, "READY_TO_BOOTSTRAP");
    assert.equal(status.nextAction, "BOOTSTRAP_WORK_ORCHESTRATION");
  } finally {
    cleanup(fixture.root);
  }
});

test("bootstrap creates consistent default Work roles, graph, and dry-run Runtime", () => {
  const fixture = createFixture();
  try {
    const result = bootstrapWorkOrchestration(fixture.root, fixture.feature, {
      now: "2026-09-13T00:00:00.000Z"
    });
    const delegation = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "agent-delegation.json")));
    const graph = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "agent-task-graph.json")));
    const runtime = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "agent-runtime.json")));

    assert.equal(result.readyTask, "builder");
    assert.equal(delegation.roles.builder, "chatgpt-builder");
    assert.equal(delegation.roles.reviewer, "codex-reviewer");
    assert.deepEqual(graph.roles, delegation.roles);
    assert.deepEqual(runtime.roles, delegation.roles);
    assert.equal(graph.tasks.builder.status, "READY");
    assert.equal(runtime.adapters.reviewer.type, "dry-run");
    assert.equal(fs.existsSync(path.join(fixture.specDir, "agent-runs")), true);

    const status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.status, "ACTIVE");
    assert.equal(status.phase, "BUILD");
  } finally {
    cleanup(fixture.root);
  }
});

test("sensitive Affected Components require an independent Security Reviewer", () => {
  const fixture = createFixture({ affected: "infra/policy.tf" });
  try {
    assert.throws(
      () => bootstrapWorkOrchestration(fixture.root, fixture.feature),
      /Security Reviewer is required/
    );
    const result = bootstrapWorkOrchestration(fixture.root, fixture.feature, {
      securityReviewer: "codex-security",
      maxRetries: 3
    });
    assert.equal(result.roles.securityReviewer, "codex-security");
    assert.equal(result.maxRetries, 3);
  } finally {
    cleanup(fixture.root);
  }
});

test("bootstrap refuses to overwrite existing or partial orchestration state", () => {
  const fixture = createFixture();
  try {
    write(path.join(fixture.specDir, "agent-delegation.json"), "{}\n");
    assert.throws(
      () => bootstrapWorkOrchestration(fixture.root, fixture.feature),
      /refusing to overwrite/
    );
  } finally {
    cleanup(fixture.root);
  }
});

test("bootstrap rolls back only files created by a failed invocation", () => {
  const fixture = createFixture();
  let writes = 0;
  try {
    assert.throws(
      () => bootstrapWorkOrchestration(fixture.root, fixture.feature, {
        writeFile(filePath, content) {
          writes += 1;
          if (writes === 2) throw new Error("simulated write failure");
          fs.writeFileSync(filePath, content, { flag: "wx" });
        }
      }),
      /was rolled back/
    );
    assert.equal(fs.existsSync(path.join(fixture.specDir, "agent-delegation.json")), false);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "agent-task-graph.json")), false);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "agent-runtime.json")), false);
  } finally {
    cleanup(fixture.root);
  }
});

test("mismatched Handoff provenance blocks bootstrap before writes", () => {
  const fixture = createFixture();
  try {
    const handoff = path.join(fixture.specDir, "implementation-handoff.md");
    fs.writeFileSync(handoff, fs.readFileSync(handoff, "utf8").replace("context-pack-feature", "wrong-context"));
    assert.throws(
      () => bootstrapWorkOrchestration(fixture.root, fixture.feature),
      /Context ID does not match/
    );
    assert.equal(fs.existsSync(path.join(fixture.specDir, "agent-delegation.json")), false);
  } finally {
    cleanup(fixture.root);
  }
});

test("status follows Task Graph phases and terminal outcomes", () => {
  const fixture = createFixture();
  try {
    bootstrapWorkOrchestration(fixture.root, fixture.feature);
    const graphPath = path.join(fixture.specDir, "agent-task-graph.json");
    let graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));

    graph = applyEvent(graph, "builder-pass");
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");
    let status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.readyTask, "reviewer");
    assert.equal(status.nextAction, "RUN_CONFORMANCE_AND_INDEPENDENT_REVIEW");

    graph = applyEvent(graph, "reviewer-pass");
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");
    status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.readyTask, "verification");

    write(
      path.join(fixture.specDir, "verification-evidence.json"),
      JSON.stringify(createEvidenceDocument({ feature: fixture.feature, status: "PASS" }))
    );
    graph = applyEvent(graph, "verify-pass");
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");
    status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.status, "COMPLETE");
    assert.equal(status.nextAction, "HUMAN_MERGE_DECISION");
  } finally {
    cleanup(fixture.root);
  }
});

test("status rejects tampered Verification Evidence before recording PASS", () => {
  const fixture = createFixture();
  try {
    bootstrapWorkOrchestration(fixture.root, fixture.feature);
    const graphPath = path.join(fixture.specDir, "agent-task-graph.json");
    let graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    graph = applyEvent(graph, "builder-pass");
    graph = applyEvent(graph, "reviewer-pass");
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");

    const evidence = createEvidenceDocument({ feature: fixture.feature, status: "PASS" });
    evidence.payload.status = "FAIL";
    write(path.join(fixture.specDir, "verification-evidence.json"), JSON.stringify(evidence));

    const status = getWorkOrchestrationStatus(fixture.root, fixture.feature);
    assert.equal(status.status, "INCONSISTENT");
    assert.ok(status.errors.some((error) => error.includes("digest is invalid")));
  } finally {
    cleanup(fixture.root);
  }
});

test("status fails closed on partial state, role drift, and invalid READY task count", () => {
  const partial = createFixture();
  try {
    write(path.join(partial.specDir, "agent-delegation.json"), "{}\n");
    assert.equal(getWorkOrchestrationStatus(partial.root, partial.feature).status, "INCONSISTENT");
  } finally {
    cleanup(partial.root);
  }

  const drift = createFixture();
  try {
    bootstrapWorkOrchestration(drift.root, drift.feature);
    const runtimePath = path.join(drift.specDir, "agent-runtime.json");
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    runtime.roles.reviewer = "different-reviewer";
    fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2) + "\n");
    assert.equal(getWorkOrchestrationStatus(drift.root, drift.feature).status, "INCONSISTENT");
  } finally {
    cleanup(drift.root);
  }

  const ready = createFixture();
  try {
    bootstrapWorkOrchestration(ready.root, ready.feature);
    const graphPath = path.join(ready.specDir, "agent-task-graph.json");
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    graph.tasks.reviewer.status = "READY";
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");
    assert.equal(getWorkOrchestrationStatus(ready.root, ready.feature).status, "INCONSISTENT");
  } finally {
    cleanup(ready.root);
  }
});
