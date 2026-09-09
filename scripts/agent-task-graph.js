#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const { readDelegation } = require("./run-verification-evidence-gate");

const EVENTS = new Set([
  "builder-pass",
  "builder-fail",
  "reviewer-pass",
  "reviewer-fail",
  "security-pass",
  "security-fail",
  "verify-pass",
  "verify-fail"
]);

function task(status, actor) {
  return { status, actor: actor || null };
}

function createInitialGraph(featureSlug, roles, maxRetries = 2, now) {
  validateFeatureSlug(featureSlug);
  const retries = Number(maxRetries);
  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error("maxRetries must be a non-negative integer");
  }

  return {
    schemaVersion: 1,
    feature: featureSlug,
    generatedAt: now || new Date().toISOString(),
    updatedAt: now || new Date().toISOString(),
    status: "ACTIVE",
    maxRetries: retries,
    retryCount: 0,
    roles: {
      builder: roles.builder,
      reviewer: roles.reviewer,
      securityReviewer: roles.securityReviewer || null
    },
    tasks: {
      builder: task("READY", roles.builder),
      reviewer: task("BLOCKED", roles.reviewer),
      securityReviewer: roles.securityReviewer
        ? task("BLOCKED", roles.securityReviewer)
        : task("SKIPPED", null),
      verification: task("BLOCKED", "verification-gate")
    },
    history: []
  };
}

function resetForRetry(graph, source, event, now) {
  const next = structuredClone(graph);
  next.history.push({
    event,
    source,
    outcome: "RETRY",
    retryCount: next.retryCount + 1,
    at: now
  });

  if (next.retryCount >= next.maxRetries) {
    next.status = "FAILED";
    next.updatedAt = now;
    next.history[next.history.length - 1].outcome = "FAILED_MAX_RETRIES";
    return next;
  }

  next.retryCount += 1;
  next.tasks.builder.status = "READY";
  next.tasks.reviewer.status = "BLOCKED";
  next.tasks.securityReviewer.status = next.roles.securityReviewer ? "BLOCKED" : "SKIPPED";
  next.tasks.verification.status = "BLOCKED";
  next.updatedAt = now;
  return next;
}

function requireReady(graph, taskName, event) {
  if (graph.tasks[taskName].status !== "READY") {
    throw new Error(event + " is not allowed while " + taskName + " is " + graph.tasks[taskName].status);
  }
}

function applyEvent(graph, event, nowValue) {
  if (!EVENTS.has(event)) {
    throw new Error("unsupported orchestrator event: " + event);
  }
  if (graph.status === "COMPLETE" || graph.status === "FAILED") {
    throw new Error("cannot transition terminal graph: " + graph.status);
  }

  const now = nowValue || new Date().toISOString();
  let next = structuredClone(graph);

  switch (event) {
    case "builder-pass":
      requireReady(next, "builder", event);
      next.tasks.builder.status = "PASS";
      next.tasks.reviewer.status = "READY";
      break;

    case "builder-fail":
      requireReady(next, "builder", event);
      next.tasks.builder.status = "FAIL";
      return resetForRetry(next, "builder", event, now);

    case "reviewer-pass":
      requireReady(next, "reviewer", event);
      next.tasks.reviewer.status = "PASS";
      if (next.roles.securityReviewer) {
        next.tasks.securityReviewer.status = "READY";
      } else {
        next.tasks.verification.status = "READY";
      }
      break;

    case "reviewer-fail":
      requireReady(next, "reviewer", event);
      next.tasks.reviewer.status = "FAIL";
      return resetForRetry(next, "reviewer", event, now);

    case "security-pass":
      if (!next.roles.securityReviewer) {
        throw new Error("security-pass is not allowed without delegated securityReviewer");
      }
      requireReady(next, "securityReviewer", event);
      next.tasks.securityReviewer.status = "PASS";
      next.tasks.verification.status = "READY";
      break;

    case "security-fail":
      if (!next.roles.securityReviewer) {
        throw new Error("security-fail is not allowed without delegated securityReviewer");
      }
      requireReady(next, "securityReviewer", event);
      next.tasks.securityReviewer.status = "FAIL";
      return resetForRetry(next, "securityReviewer", event, now);

    case "verify-pass":
      requireReady(next, "verification", event);
      next.tasks.verification.status = "PASS";
      next.status = "COMPLETE";
      break;

    case "verify-fail":
      requireReady(next, "verification", event);
      next.tasks.verification.status = "FAIL";
      return resetForRetry(next, "verification", event, now);
  }

  next.updatedAt = now;
  next.history.push({
    event,
    outcome: next.status,
    retryCount: next.retryCount,
    at: now
  });
  return next;
}

function graphPath(repositoryRoot, featureSlug) {
  return path.join(repositoryRoot, ".kiro", "specs", featureSlug, "agent-task-graph.json");
}

function initGraph(repositoryRoot, featureSlug, maxRetries = 2, options = {}) {
  const root = path.resolve(repositoryRoot);
  const delegation = options.delegationResult || readDelegation(root, featureSlug);
  if (!delegation.valid) {
    throw new Error(delegation.error);
  }

  const graph = createInitialGraph(
    featureSlug,
    delegation.roles,
    maxRetries,
    options.now
  );
  const outputPath = graphPath(root, featureSlug);
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2) + "\n");
  return { graph, outputPath };
}

function transitionGraph(repositoryRoot, featureSlug, event, options = {}) {
  const root = path.resolve(repositoryRoot);
  const outputPath = graphPath(root, featureSlug);
  if (!fs.existsSync(outputPath)) {
    throw new Error("agent-task-graph.json is missing");
  }

  const current = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (current.feature !== featureSlug) {
    throw new Error("task graph feature does not match requested feature");
  }

  const next = applyEvent(current, event, options.now);
  fs.writeFileSync(outputPath, JSON.stringify(next, null, 2) + "\n");
  return { graph: next, outputPath };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const [mode, featureSlug, value] = process.argv.slice(2);

  if (!mode || !featureSlug) {
    console.error("Usage: node scripts/agent-task-graph.js <init|event> <feature-slug> [max-retries|event]");
    process.exitCode = 2;
    return;
  }

  try {
    if (mode === "init") {
      const result = initGraph(repositoryRoot, featureSlug, value === undefined ? 2 : Number(value));
      console.log("Agent Task Graph initialized: " + path.relative(repositoryRoot, result.outputPath));
      console.log("- Status: " + result.graph.status);
      console.log("- Builder: READY");
      console.log("- Max retries: " + result.graph.maxRetries);
      return;
    }

    if (mode === "event") {
      if (!value) throw new Error("event is required");
      const result = transitionGraph(repositoryRoot, featureSlug, value);
      console.log("Agent Task Graph updated: " + value);
      console.log("- Status: " + result.graph.status);
      console.log("- Retry count: " + result.graph.retryCount);
      return;
    }

    throw new Error("mode must be init or event");
  } catch (error) {
    console.error("Agent Task Graph failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  EVENTS,
  applyEvent,
  createInitialGraph,
  graphPath,
  initGraph,
  transitionGraph
};
