#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const { graphPath, transitionGraph } = require("./agent-task-graph");

const TASK_EVENTS = {
  builder: { PASS: "builder-pass", FAIL: "builder-fail", TIMEOUT: "builder-fail" },
  reviewer: { PASS: "reviewer-pass", FAIL: "reviewer-fail", TIMEOUT: "reviewer-fail" },
  securityReviewer: { PASS: "security-pass", FAIL: "security-fail", TIMEOUT: "security-fail" },
  verification: { PASS: "verify-pass", FAIL: "verify-fail", TIMEOUT: "verify-fail" }
};

function runtimePath(repositoryRoot, featureSlug) {
  return path.join(repositoryRoot, ".kiro", "specs", featureSlug, "agent-runtime.json");
}

function runsDir(repositoryRoot, featureSlug) {
  return path.join(repositoryRoot, ".kiro", "specs", featureSlug, "agent-runs");
}

function readGraph(repositoryRoot, featureSlug) {
  const file = graphPath(repositoryRoot, featureSlug);
  if (!fs.existsSync(file)) throw new Error("agent-task-graph.json is missing");
  const graph = JSON.parse(fs.readFileSync(file, "utf8"));
  if (graph.feature !== featureSlug) throw new Error("task graph feature does not match requested feature");
  return graph;
}

function createRuntimeConfig(featureSlug, graph, now) {
  validateFeatureSlug(featureSlug);
  return {
    schemaVersion: 1,
    feature: featureSlug,
    generatedAt: now || new Date().toISOString(),
    adapters: {
      builder: { type: "dry-run", timeoutMs: 300000 },
      reviewer: { type: "dry-run", timeoutMs: 300000 },
      securityReviewer: { type: "dry-run", timeoutMs: 300000 },
      verification: { type: "dry-run", timeoutMs: 300000 }
    },
    roles: graph.roles
  };
}

function initRuntime(repositoryRoot, featureSlug, options = {}) {
  const root = path.resolve(repositoryRoot);
  const graph = options.graph || readGraph(root, featureSlug);
  const config = createRuntimeConfig(featureSlug, graph, options.now);
  const file = runtimePath(root, featureSlug);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  fs.mkdirSync(runsDir(root, featureSlug), { recursive: true });
  return { config, outputPath: file };
}

function normalizeScriptedResult(value) {
  const result = String(value || "").trim().toUpperCase();
  if (!["PASS", "FAIL", "TIMEOUT"].includes(result)) {
    throw new Error("scripted adapter result must be PASS, FAIL, or TIMEOUT");
  }
  return result;
}

function createRunEvidence({ featureSlug, taskName, actor, adapter, result, startedAt, finishedAt, graphEvent }) {
  return {
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    feature: featureSlug,
    task: taskName,
    actor,
    adapter: adapter.type,
    timeoutMs: adapter.timeoutMs,
    result,
    graphEvent: graphEvent || null,
    startedAt,
    finishedAt
  };
}

function runTask(repositoryRoot, featureSlug, taskName, options = {}) {
  validateFeatureSlug(featureSlug);
  if (!Object.hasOwn(TASK_EVENTS, taskName)) throw new Error("unsupported runtime task: " + taskName);

  const root = path.resolve(repositoryRoot);
  const graph = options.graph || readGraph(root, featureSlug);
  if (graph.status !== "ACTIVE") throw new Error("task graph must be ACTIVE");
  const graphTask = graph.tasks && graph.tasks[taskName];
  if (!graphTask || graphTask.status !== "READY") {
    throw new Error(taskName + " task is not READY");
  }

  const runtimeFile = runtimePath(root, featureSlug);
  if (!fs.existsSync(runtimeFile)) throw new Error("agent-runtime.json is missing");
  const config = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
  if (config.feature !== featureSlug) throw new Error("runtime feature does not match requested feature");
  const adapter = config.adapters && config.adapters[taskName];
  if (!adapter) throw new Error("runtime adapter is missing for task: " + taskName);

  const actor = graphTask.actor || null;
  const configuredRole = config.roles && config.roles[taskName];
  if (taskName !== "verification" && configuredRole !== actor) {
    throw new Error("runtime actor provenance differs from Task Graph: " + taskName);
  }

  const startedAt = options.startedAt || new Date().toISOString();
  let result;
  let graphEvent = null;

  if (adapter.type === "dry-run") {
    result = "DRY_RUN";
  } else if (adapter.type === "scripted") {
    result = normalizeScriptedResult(options.scriptedResult);
    graphEvent = TASK_EVENTS[taskName][result];
  } else {
    throw new Error("unsupported runtime adapter: " + adapter.type);
  }

  const finishedAt = options.finishedAt || new Date().toISOString();
  const evidence = createRunEvidence({
    featureSlug,
    taskName,
    actor,
    adapter,
    result,
    startedAt,
    finishedAt,
    graphEvent
  });

  const dir = runsDir(root, featureSlug);
  fs.mkdirSync(dir, { recursive: true });
  const evidencePath = path.join(dir, evidence.runId + ".json");
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");

  let transition = null;
  if (graphEvent) {
    transition = options.transitionRunner
      ? options.transitionRunner(root, featureSlug, graphEvent, { now: finishedAt })
      : transitionGraph(root, featureSlug, graphEvent, { now: finishedAt });
  }

  return { evidence, evidencePath, transition };
}

function listRunEvidence(repositoryRoot, featureSlug) {
  const dir = runsDir(path.resolve(repositoryRoot), featureSlug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const [mode, featureSlug, taskName, scriptedResult] = process.argv.slice(2);

  if (!mode || !featureSlug) {
    console.error("Usage: node scripts/agent-runtime-adapter.js <init|run> <feature-slug> [task-name] [scripted-result]");
    process.exitCode = 2;
    return;
  }

  try {
    if (mode === "init") {
      const result = initRuntime(repositoryRoot, featureSlug);
      console.log("Agent Runtime initialized: " + path.relative(repositoryRoot, result.outputPath));
      return;
    }

    if (mode === "run") {
      if (!taskName) throw new Error("task-name is required");
      const result = runTask(repositoryRoot, featureSlug, taskName, { scriptedResult });
      console.log("Agent Runtime run recorded: " + result.evidence.runId);
      console.log("- Task: " + result.evidence.task);
      console.log("- Adapter: " + result.evidence.adapter);
      console.log("- Result: " + result.evidence.result);
      console.log("- Graph event: " + (result.evidence.graphEvent || "none"));
      return;
    }

    throw new Error("mode must be init or run");
  } catch (error) {
    console.error("Agent Runtime failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  TASK_EVENTS,
  createRunEvidence,
  createRuntimeConfig,
  initRuntime,
  listRunEvidence,
  normalizeScriptedResult,
  runTask,
  runtimePath,
  runsDir
};
