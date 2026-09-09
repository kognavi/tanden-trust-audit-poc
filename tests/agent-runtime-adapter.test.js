const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createRuntimeConfig,
  initRuntime,
  listRunEvidence,
  runTask
} = require("../scripts/agent-runtime-adapter");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-runtime-"));
  try {
    const specDir = path.join(root, ".kiro", "specs", "feature");
    fs.mkdirSync(specDir, { recursive: true });
    const graph = {
      schemaVersion: 1,
      feature: "feature",
      status: "ACTIVE",
      retryCount: 0,
      maxRetries: 2,
      roles: {
        builder: "builder-a",
        reviewer: "reviewer-b",
        securityReviewer: null
      },
      tasks: {
        builder: { status: "READY", actor: "builder-a" },
        reviewer: { status: "BLOCKED", actor: "reviewer-b" },
        securityReviewer: { status: "SKIPPED", actor: null },
        verification: { status: "BLOCKED", actor: "verification-gate" }
      },
      history: []
    };
    fs.writeFileSync(path.join(specDir, "agent-task-graph.json"), JSON.stringify(graph, null, 2) + "\n");
    return run(root, graph);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("runtime config defaults all tasks to dry-run", () => {
  const graph = {
    roles: { builder: "b", reviewer: "r", securityReviewer: null }
  };
  const config = createRuntimeConfig("feature", graph, "2026-09-09T00:00:00.000Z");
  assert.equal(config.adapters.builder.type, "dry-run");
  assert.equal(config.adapters.verification.type, "dry-run");
});

test("runtime init writes config and run directory", () =>
  fixture((root, graph) => {
    const result = initRuntime(root, "feature", { graph, now: "2026-09-09T00:00:00.000Z" });
    assert.equal(fs.existsSync(result.outputPath), true);
    assert.equal(fs.existsSync(path.join(root, ".kiro", "specs", "feature", "agent-runs")), true);
  }));

test("dry-run records evidence but does not transition graph", () =>
  fixture((root, graph) => {
    initRuntime(root, "feature", { graph });
    let transitionCalled = false;
    const result = runTask(root, "feature", "builder", {
      graph,
      startedAt: "2026-09-09T00:00:00.000Z",
      finishedAt: "2026-09-09T00:00:01.000Z",
      transitionRunner: () => {
        transitionCalled = true;
      }
    });
    assert.equal(result.evidence.result, "DRY_RUN");
    assert.equal(result.evidence.graphEvent, null);
    assert.equal(transitionCalled, false);
    assert.equal(listRunEvidence(root, "feature").length, 1);
  }));

test("scripted PASS maps to builder-pass and transitions", () =>
  fixture((root, graph) => {
    const runtime = initRuntime(root, "feature", { graph });
    const config = JSON.parse(fs.readFileSync(runtime.outputPath, "utf8"));
    config.adapters.builder.type = "scripted";
    fs.writeFileSync(runtime.outputPath, JSON.stringify(config, null, 2) + "\n");

    let seenEvent = null;
    const result = runTask(root, "feature", "builder", {
      graph,
      scriptedResult: "PASS",
      transitionRunner: (_root, _feature, event) => {
        seenEvent = event;
        return { graph: { status: "ACTIVE" } };
      }
    });
    assert.equal(result.evidence.result, "PASS");
    assert.equal(result.evidence.graphEvent, "builder-pass");
    assert.equal(seenEvent, "builder-pass");
  }));

test("scripted TIMEOUT maps to role failure event", () =>
  fixture((root, graph) => {
    const runtime = initRuntime(root, "feature", { graph });
    const config = JSON.parse(fs.readFileSync(runtime.outputPath, "utf8"));
    config.adapters.builder.type = "scripted";
    fs.writeFileSync(runtime.outputPath, JSON.stringify(config, null, 2) + "\n");

    let seenEvent = null;
    const result = runTask(root, "feature", "builder", {
      graph,
      scriptedResult: "TIMEOUT",
      transitionRunner: (_root, _feature, event) => {
        seenEvent = event;
        return { graph: { status: "ACTIVE" } };
      }
    });
    assert.equal(result.evidence.result, "TIMEOUT");
    assert.equal(seenEvent, "builder-fail");
  }));

test("blocked task cannot be executed", () =>
  fixture((root, graph) => {
    initRuntime(root, "feature", { graph });
    assert.throws(() => runTask(root, "feature", "reviewer", { graph }), /not READY/);
  }));

test("runtime actor drift from Task Graph is rejected", () =>
  fixture((root, graph) => {
    const runtime = initRuntime(root, "feature", { graph });
    const config = JSON.parse(fs.readFileSync(runtime.outputPath, "utf8"));
    config.roles.builder = "other-builder";
    fs.writeFileSync(runtime.outputPath, JSON.stringify(config, null, 2) + "\n");
    assert.throws(() => runTask(root, "feature", "builder", { graph }), /actor provenance/);
  }));
