#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");

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

function configureCodexReviewer(repositoryRoot, featureSlug, options = {}) {
  const root = path.resolve(repositoryRoot);
  const file = runtimePath(root, featureSlug);
  if (!fs.existsSync(file)) throw new Error("agent-runtime.json is missing");

  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  if (config.feature !== featureSlug) throw new Error("runtime feature does not match requested feature");

  const timeoutMs = options.timeoutMs === undefined ? 300000 : Number(options.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive integer");
  }

  config.adapters.reviewer = {
    type: "codex-exec-review",
    command: options.command || "codex",
    timeoutMs,
    baseRef: options.baseRef || "main",
    sandbox: "read-only"
  };
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  return { config, outputPath: file };
}

function normalizeScriptedResult(value) {
  const result = String(value || "").trim().toUpperCase();
  if (!["PASS", "FAIL", "TIMEOUT"].includes(result)) {
    throw new Error("scripted adapter result must be PASS, FAIL, or TIMEOUT");
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function buildCodexReviewPrompt(featureSlug, baseRef) {
  return [
    "Act as the delegated independent Reviewer for this repository.",
    "Do not modify repository files.",
    "Read AGENTS.md and the feature specification under .kiro/specs/" + featureSlug + "/.",
    "Review the implementation diff against base ref " + baseRef + ".",
    "Check requirements coverage, scope drift, tests, maintainability, security-sensitive behavior, and silent behavior changes.",
    "Return only a final response conforming to the supplied JSON Schema.",
    "Use verdict PASS only when no blocking finding remains.",
    "Use verdict FAIL when any blocking correctness, security, governance, or specification issue remains.",
    "Do not include secrets, credentials, raw prompts, or unnecessary sensitive data."
  ].join("\n");
}

function extractCodexSessionId(stdout) {
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed);
      if (event.type === "thread.started") {
        return event.thread_id || event.threadId || event.thread?.id || event.id || null;
      }
    } catch (_error) {
      // Ignore non-JSON lines. The provider process status is evaluated separately.
    }
  }
  return null;
}

function parseCodexReviewVerdict(raw) {
  const value = JSON.parse(String(raw || ""));
  if (!value || !["PASS", "FAIL"].includes(value.verdict)) {
    throw new Error("Codex review output must contain verdict PASS or FAIL");
  }
  if (typeof value.summary !== "string" || !value.summary.trim()) {
    throw new Error("Codex review output must contain summary");
  }
  if (!Array.isArray(value.findings)) {
    throw new Error("Codex review output must contain findings array");
  }
  const allowedSeverities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const findings = value.findings.map((finding) => {
    const severity = String(finding.severity || "").trim();
    const title = String(finding.title || "").trim();
    if (!allowedSeverities.has(severity) || !title) {
      throw new Error("Codex review finding is invalid");
    }
    return { severity, title };
  });
  return {
    verdict: value.verdict,
    summary: value.summary.trim(),
    findings
  };
}

function reviewerArtifactPath(repositoryRoot, featureSlug) {
  return path.join(repositoryRoot, ".kiro", "specs", featureSlug, "reviewer-review.md");
}

function writeReviewerArtifact(repositoryRoot, featureSlug, actor, review, providerSessionId) {
  const lines = [
    "# Reviewer Review",
    "",
    "- Status: " + review.verdict,
    "- Reviewed by: " + actor,
    "- Provider: codex-cli",
    "- Provider Session: " + (providerSessionId || "unavailable"),
    "",
    "## Summary",
    "",
    review.summary,
    "",
    "## Findings",
    ""
  ];
  if (review.findings.length === 0) {
    lines.push("- None");
  } else {
    for (const finding of review.findings) {
      lines.push("- [" + finding.severity + "] " + finding.title);
    }
  }
  const file = reviewerArtifactPath(repositoryRoot, featureSlug);
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

function createRunEvidence({
  featureSlug,
  taskName,
  actor,
  adapter,
  result,
  startedAt,
  finishedAt,
  graphEvent,
  provider,
  verdict
}) {
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
    provider: provider || null,
    verdict: verdict || null,
    startedAt,
    finishedAt
  };
}

function isTimeoutProcessResult(processResult) {
  return Boolean(processResult?.error && processResult.error.code === "ETIMEDOUT");
}

function runCodexReviewer(repositoryRoot, featureSlug, actor, adapter, options = {}) {
  const root = path.resolve(repositoryRoot);
  const dir = runsDir(root, featureSlug);
  fs.mkdirSync(dir, { recursive: true });

  const tempId = crypto.randomUUID();
  const lastMessagePath = path.join(dir, ".codex-last-" + tempId + ".json");
  const schemaPath = path.join(root, "schemas", "codex-review-result.schema.json");
  if (!fs.existsSync(schemaPath)) throw new Error("Codex review output schema is missing");

  const baseRef = adapter.baseRef || "main";
  const prompt = buildCodexReviewPrompt(featureSlug, baseRef);
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--ignore-user-config",
    "--sandbox",
    adapter.sandbox || "read-only",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    lastMessagePath,
    "-"
  ];

  const runner = options.processRunner || childProcess.spawnSync;
  let processResult;
  try {
    processResult = runner(adapter.command || "codex", args, {
      cwd: root,
      input: prompt,
      encoding: "utf8",
      timeout: adapter.timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
      env: options.env || process.env
    }) || {};
  } catch (error) {
    processResult = { status: null, stdout: "", stderr: "", error };
  }

  const stdout = String(processResult.stdout || "");
  const stderr = String(processResult.stderr || "");
  const providerSessionId = extractCodexSessionId(stdout);
  const providerBase = {
    name: "codex-cli",
    sessionId: providerSessionId,
    command: adapter.command || "codex",
    sandbox: adapter.sandbox || "read-only",
    exitCode: Number.isInteger(processResult.status) ? processResult.status : null,
    promptDigest: sha256(prompt),
    stdoutDigest: sha256(stdout),
    stderrDigest: sha256(stderr)
  };

  try {
    if (isTimeoutProcessResult(processResult)) {
      return {
        result: "TIMEOUT",
        graphEvent: "reviewer-fail",
        provider: { ...providerBase, executionStatus: "TIMEOUT" },
        review: null,
        reviewerArtifact: null
      };
    }

    if (processResult.error || processResult.status !== 0) {
      return {
        result: "PROVIDER_ERROR",
        graphEvent: null,
        provider: {
          ...providerBase,
          executionStatus: "ERROR",
          errorCode: processResult.error?.code || null
        },
        review: null,
        reviewerArtifact: null
      };
    }

    if (!fs.existsSync(lastMessagePath)) {
      return {
        result: "PROVIDER_ERROR",
        graphEvent: null,
        provider: { ...providerBase, executionStatus: "INVALID_OUTPUT" },
        review: null,
        reviewerArtifact: null
      };
    }

    const reviewRaw = fs.readFileSync(lastMessagePath, "utf8");
    let review;
    try {
      review = parseCodexReviewVerdict(reviewRaw);
    } catch (_error) {
      return {
        result: "PROVIDER_ERROR",
        graphEvent: null,
        provider: {
          ...providerBase,
          executionStatus: "INVALID_OUTPUT",
          finalMessageDigest: sha256(reviewRaw)
        },
        review: null,
        reviewerArtifact: null
      };
    }

    const reviewerArtifact = writeReviewerArtifact(
      root,
      featureSlug,
      actor,
      review,
      providerSessionId
    );

    return {
      result: review.verdict,
      graphEvent: review.verdict === "PASS" ? "reviewer-pass" : "reviewer-fail",
      provider: {
        ...providerBase,
        executionStatus: "SUCCESS",
        finalMessageDigest: sha256(reviewRaw)
      },
      review,
      reviewerArtifact
    };
  } finally {
    if (fs.existsSync(lastMessagePath)) fs.rmSync(lastMessagePath, { force: true });
  }
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
  let provider = null;
  let reviewerArtifact = null;
  let verdict = null;

  if (adapter.type === "dry-run") {
    result = "DRY_RUN";
  } else if (adapter.type === "scripted") {
    result = normalizeScriptedResult(options.scriptedResult);
    graphEvent = TASK_EVENTS[taskName][result];
  } else if (adapter.type === "codex-exec-review") {
    if (taskName !== "reviewer") {
      throw new Error("codex-exec-review adapter only supports reviewer task");
    }
    const providerResult = runCodexReviewer(root, featureSlug, actor, adapter, options);
    result = providerResult.result;
    graphEvent = providerResult.graphEvent;
    provider = providerResult.provider;
    reviewerArtifact = providerResult.reviewerArtifact;
    verdict = providerResult.review?.verdict || null;
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
    graphEvent,
    provider,
    verdict
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

  return { evidence, evidencePath, transition, reviewerArtifact };
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
  const [mode, featureSlug, taskName, value] = process.argv.slice(2);

  if (!mode || !featureSlug) {
    console.error(
      "Usage: node scripts/agent-runtime-adapter.js <init|configure-codex-review|run> <feature-slug> [task-name|timeout-ms] [scripted-result]"
    );
    process.exitCode = 2;
    return;
  }

  try {
    if (mode === "init") {
      const result = initRuntime(repositoryRoot, featureSlug);
      console.log("Agent Runtime initialized: " + path.relative(repositoryRoot, result.outputPath));
      return;
    }

    if (mode === "configure-codex-review") {
      const result = configureCodexReviewer(repositoryRoot, featureSlug, {
        timeoutMs: taskName === undefined ? undefined : Number(taskName)
      });
      console.log("Codex Reviewer Adapter configured: " + path.relative(repositoryRoot, result.outputPath));
      console.log("- Adapter: codex-exec-review");
      console.log("- Sandbox: read-only");
      return;
    }

    if (mode === "run") {
      if (!taskName) throw new Error("task-name is required");
      const result = runTask(repositoryRoot, featureSlug, taskName, { scriptedResult: value });
      console.log("Agent Runtime run recorded: " + result.evidence.runId);
      console.log("- Task: " + result.evidence.task);
      console.log("- Adapter: " + result.evidence.adapter);
      console.log("- Result: " + result.evidence.result);
      console.log("- Graph event: " + (result.evidence.graphEvent || "none"));
      if (result.evidence.provider?.sessionId) {
        console.log("- Provider session: " + result.evidence.provider.sessionId);
      }
      return;
    }

    throw new Error("mode must be init, configure-codex-review, or run");
  } catch (error) {
    console.error("Agent Runtime failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  TASK_EVENTS,
  buildCodexReviewPrompt,
  configureCodexReviewer,
  createRunEvidence,
  createRuntimeConfig,
  extractCodexSessionId,
  initRuntime,
  listRunEvidence,
  normalizeScriptedResult,
  parseCodexReviewVerdict,
  reviewerArtifactPath,
  runCodexReviewer,
  runTask,
  runtimePath,
  runsDir,
  sha256,
  writeReviewerArtifact
};
