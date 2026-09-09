const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  applyEvent,
  createInitialGraph,
  initGraph,
  transitionGraph
} = require("../scripts/agent-task-graph");

const roles = {
  builder: "builder-a",
  reviewer: "reviewer-b",
  securityReviewer: null
};

test("initial graph starts Builder READY and later tasks blocked", () => {
  const graph = createInitialGraph("feature", roles, 2, "2026-09-09T00:00:00.000Z");
  assert.equal(graph.status, "ACTIVE");
  assert.equal(graph.tasks.builder.status, "READY");
  assert.equal(graph.tasks.reviewer.status, "BLOCKED");
  assert.equal(graph.tasks.securityReviewer.status, "SKIPPED");
  assert.equal(graph.tasks.verification.status, "BLOCKED");
});

test("happy path without security reviewer reaches COMPLETE", () => {
  let graph = createInitialGraph("feature", roles, 2, "2026-09-09T00:00:00.000Z");
  graph = applyEvent(graph, "builder-pass", "2026-09-09T00:01:00.000Z");
  assert.equal(graph.tasks.reviewer.status, "READY");

  graph = applyEvent(graph, "reviewer-pass", "2026-09-09T00:02:00.000Z");
  assert.equal(graph.tasks.verification.status, "READY");

  graph = applyEvent(graph, "verify-pass", "2026-09-09T00:03:00.000Z");
  assert.equal(graph.status, "COMPLETE");
  assert.equal(graph.tasks.verification.status, "PASS");
});

test("security reviewer branch is required when delegated", () => {
  let graph = createInitialGraph("feature", {
    ...roles,
    securityReviewer: "security-c"
  }, 2, "2026-09-09T00:00:00.000Z");

  graph = applyEvent(graph, "builder-pass");
  graph = applyEvent(graph, "reviewer-pass");
  assert.equal(graph.tasks.securityReviewer.status, "READY");
  assert.equal(graph.tasks.verification.status, "BLOCKED");

  graph = applyEvent(graph, "security-pass");
  assert.equal(graph.tasks.verification.status, "READY");
});

test("out of order reviewer event is rejected", () => {
  const graph = createInitialGraph("feature", roles, 2);
  assert.throws(
    () => applyEvent(graph, "reviewer-pass"),
    /not allowed/
  );
});

test("reviewer failure routes back to Builder and increments retry", () => {
  let graph = createInitialGraph("feature", roles, 2);
  graph = applyEvent(graph, "builder-pass");
  graph = applyEvent(graph, "reviewer-fail");
  assert.equal(graph.retryCount, 1);
  assert.equal(graph.tasks.builder.status, "READY");
  assert.equal(graph.tasks.reviewer.status, "BLOCKED");
});

test("retry limit produces FAILED terminal state", () => {
  let graph = createInitialGraph("feature", roles, 1);
  graph = applyEvent(graph, "builder-fail");
  assert.equal(graph.retryCount, 1);
  assert.equal(graph.status, "ACTIVE");

  graph = applyEvent(graph, "builder-fail");
  assert.equal(graph.status, "FAILED");
  assert.equal(graph.retryCount, 1);
  assert.throws(() => applyEvent(graph, "builder-pass"), /terminal graph/);
});

test("verification failure routes back to Builder", () => {
  let graph = createInitialGraph("feature", roles, 2);
  graph = applyEvent(graph, "builder-pass");
  graph = applyEvent(graph, "reviewer-pass");
  graph = applyEvent(graph, "verify-fail");
  assert.equal(graph.retryCount, 1);
  assert.equal(graph.tasks.builder.status, "READY");
});

test("security event without delegated security reviewer is rejected", () => {
  let graph = createInitialGraph("feature", roles, 2);
  graph = applyEvent(graph, "builder-pass");
  graph = applyEvent(graph, "reviewer-pass");
  assert.throws(() => applyEvent(graph, "security-pass"), /without delegated/);
});

test("init and transition persist graph in feature spec", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-graph-"));
  try {
    const specDir = path.join(root, ".kiro", "specs", "feature");
    fs.mkdirSync(specDir, { recursive: true });
    const delegationResult = {
      valid: true,
      roles
    };

    const init = initGraph(root, "feature", 2, {
      delegationResult,
      now: "2026-09-09T00:00:00.000Z"
    });
    assert.equal(fs.existsSync(init.outputPath), true);

    const updated = transitionGraph(root, "feature", "builder-pass", {
      now: "2026-09-09T00:01:00.000Z"
    });
    assert.equal(updated.graph.tasks.reviewer.status, "READY");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
