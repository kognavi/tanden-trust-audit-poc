const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  configureCodexReviewer,
  createRuntimeConfig,
  extractCodexSessionId,
  initRuntime,
  listRunEvidence,
  runTask
} = require("../scripts/agent-runtime-adapter");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-runtime-"));
  try {
    const specDir = path.join(root, ".kiro", "specs", "feature");
    fs.mkdirSync(specDir, { recursive: true });
    const schemaDir = path.join(root, "schemas");
    fs.mkdirSync(schemaDir, { recursive: true });
    fs.writeFileSync(
      path.join(schemaDir, "codex-review-result.schema.json"),
      JSON.stringify({
        type: "object",
        required: ["verdict", "summary", "findings"],
        properties: {
          verdict: { enum: ["PASS", "FAIL"] },
          summary: { type: "string" },
          findings: { type: "array" }
        }
      }, null, 2) + "\n"
    );
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


function makeReviewerReady(graph) {
  const next = structuredClone(graph);
  next.tasks.builder.status = "PASS";
  next.tasks.reviewer.status = "READY";
  return next;
}

test("Codex JSONL parser extracts provider thread id", () => {
  const stdout = [
    JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
    JSON.stringify({ type: "turn.completed" })
  ].join("\n");
  assert.equal(extractCodexSessionId(stdout), "thread-123");
});

test("configureCodexReviewer opts reviewer into real provider with read-only sandbox", () =>
  fixture((root, graph) => {
    initRuntime(root, "feature", { graph });
    const result = configureCodexReviewer(root, "feature", {
      timeoutMs: 120000,
      command: "codex-test",
      baseRef: "main"
    });
    assert.equal(result.config.adapters.reviewer.type, "codex-exec-review");
    assert.equal(result.config.adapters.reviewer.command, "codex-test");
    assert.equal(result.config.adapters.reviewer.sandbox, "read-only");
    assert.equal(result.config.adapters.reviewer.timeoutMs, 120000);
  }));

test("real Codex reviewer PASS writes review artifact and advances reviewer-pass", () =>
  fixture((root, graph) => {
    const readyGraph = makeReviewerReady(graph);
    fs.writeFileSync(
      path.join(root, ".kiro", "specs", "feature", "agent-task-graph.json"),
      JSON.stringify(readyGraph, null, 2) + "\n"
    );
    initRuntime(root, "feature", { graph: readyGraph });
    configureCodexReviewer(root, "feature", { command: "codex-test" });

    let seenEvent = null;
    const processRunner = (command, args, options) => {
      assert.equal(command, "codex-test");
      assert.equal(options.shell, false);
      assert.equal(options.cwd, root);
      assert.match(options.input, /delegated independent Reviewer/);
      assert.ok(args.includes("--json"));
      assert.ok(args.includes("--ephemeral"));
      assert.ok(args.includes("--ignore-user-config"));
      assert.ok(args.includes("read-only"));
      const outputIndex = args.indexOf("--output-last-message");
      fs.writeFileSync(
        args[outputIndex + 1],
        JSON.stringify({ verdict: "PASS", summary: "No blocking findings.", findings: [] })
      );
      return {
        status: 0,
        signal: null,
        stdout: JSON.stringify({ type: "thread.started", thread_id: "codex-thread-1" }) + "\n",
        stderr: ""
      };
    };

    const result = runTask(root, "feature", "reviewer", {
      graph: readyGraph,
      processRunner,
      transitionRunner: (_root, _feature, event) => {
        seenEvent = event;
        return { graph: { status: "ACTIVE" } };
      }
    });

    assert.equal(result.evidence.result, "PASS");
    assert.equal(result.evidence.verdict, "PASS");
    assert.equal(result.evidence.graphEvent, "reviewer-pass");
    assert.equal(result.evidence.provider.name, "codex-cli");
    assert.equal(result.evidence.provider.sessionId, "codex-thread-1");
    assert.equal(result.evidence.provider.executionStatus, "SUCCESS");
    assert.equal(seenEvent, "reviewer-pass");
    assert.equal(fs.existsSync(result.reviewerArtifact), true);

    const review = fs.readFileSync(result.reviewerArtifact, "utf8");
    assert.match(review, /Status: PASS/);
    assert.match(review, /Reviewed by: reviewer-b/);
    assert.match(review, /Provider Session: codex-thread-1/);

    const persisted = JSON.parse(fs.readFileSync(result.evidencePath, "utf8"));
    assert.equal(Object.hasOwn(persisted.provider, "stdout"), false);
    assert.equal(Object.hasOwn(persisted.provider, "stderr"), false);
    assert.equal(Object.hasOwn(persisted.provider, "prompt"), false);
    assert.match(persisted.provider.stdoutDigest, /^[a-f0-9]{64}$/);
    assert.match(persisted.provider.promptDigest, /^[a-f0-9]{64}$/);
  }));

test("real Codex reviewer FAIL advances reviewer-fail independently of process success", () =>
  fixture((root, graph) => {
    const readyGraph = makeReviewerReady(graph);
    fs.writeFileSync(
      path.join(root, ".kiro", "specs", "feature", "agent-task-graph.json"),
      JSON.stringify(readyGraph, null, 2) + "\n"
    );
    initRuntime(root, "feature", { graph: readyGraph });
    configureCodexReviewer(root, "feature", { command: "codex-test" });

    let seenEvent = null;
    const result = runTask(root, "feature", "reviewer", {
      graph: readyGraph,
      processRunner: (_command, args) => {
        const outputIndex = args.indexOf("--output-last-message");
        fs.writeFileSync(
          args[outputIndex + 1],
          JSON.stringify({
            verdict: "FAIL",
            summary: "Blocking issue found.",
            findings: [{ severity: "HIGH", title: "Requirement not implemented" }]
          })
        );
        return {
          status: 0,
          stdout: JSON.stringify({ type: "thread.started", thread_id: "codex-thread-2" }) + "\n",
          stderr: ""
        };
      },
      transitionRunner: (_root, _feature, event) => {
        seenEvent = event;
        return { graph: { status: "ACTIVE" } };
      }
    });

    assert.equal(result.evidence.result, "FAIL");
    assert.equal(result.evidence.provider.exitCode, 0);
    assert.equal(seenEvent, "reviewer-fail");
  }));

test("real Codex reviewer timeout maps to reviewer-fail", () =>
  fixture((root, graph) => {
    const readyGraph = makeReviewerReady(graph);
    fs.writeFileSync(
      path.join(root, ".kiro", "specs", "feature", "agent-task-graph.json"),
      JSON.stringify(readyGraph, null, 2) + "\n"
    );
    initRuntime(root, "feature", { graph: readyGraph });
    configureCodexReviewer(root, "feature", { command: "codex-test" });

    let seenEvent = null;
    const result = runTask(root, "feature", "reviewer", {
      graph: readyGraph,
      processRunner: () => ({
        status: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
        error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })
      }),
      transitionRunner: (_root, _feature, event) => {
        seenEvent = event;
        return { graph: { status: "ACTIVE" } };
      }
    });

    assert.equal(result.evidence.result, "TIMEOUT");
    assert.equal(result.evidence.provider.executionStatus, "TIMEOUT");
    assert.equal(seenEvent, "reviewer-fail");
  }));

test("Codex provider error records evidence but does not advance Task Graph", () =>
  fixture((root, graph) => {
    const readyGraph = makeReviewerReady(graph);
    fs.writeFileSync(
      path.join(root, ".kiro", "specs", "feature", "agent-task-graph.json"),
      JSON.stringify(readyGraph, null, 2) + "\n"
    );
    initRuntime(root, "feature", { graph: readyGraph });
    configureCodexReviewer(root, "feature", { command: "missing-codex" });

    let transitionCalled = false;
    const result = runTask(root, "feature", "reviewer", {
      graph: readyGraph,
      processRunner: () => ({
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        error: Object.assign(new Error("not found"), { code: "ENOENT" })
      }),
      transitionRunner: () => {
        transitionCalled = true;
      }
    });

    assert.equal(result.evidence.result, "PROVIDER_ERROR");
    assert.equal(result.evidence.graphEvent, null);
    assert.equal(result.evidence.provider.errorCode, "ENOENT");
    assert.equal(transitionCalled, false);
  }));

test("codex-exec-review adapter rejects non-reviewer task", () =>
  fixture((root, graph) => {
    const runtime = initRuntime(root, "feature", { graph });
    const config = JSON.parse(fs.readFileSync(runtime.outputPath, "utf8"));
    config.adapters.builder = {
      type: "codex-exec-review",
      command: "codex",
      timeoutMs: 300000,
      baseRef: "main",
      sandbox: "read-only"
    };
    fs.writeFileSync(runtime.outputPath, JSON.stringify(config, null, 2) + "\n");
    assert.throws(
      () => runTask(root, "feature", "builder", { graph }),
      /only supports reviewer task/
    );
  }));
