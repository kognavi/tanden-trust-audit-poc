#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const { validateSpecDirectory } = require("./check-spec-readiness");
const {
  extractHandoffProvenance,
  isSensitivePath,
  parseAffectedComponents
} = require("./check-implementation-conformance");
const {
  createDelegationDocument,
  validateDelegationRoles
} = require("./create-agent-delegation");
const { createInitialGraph } = require("./agent-task-graph");
const {
  createRuntimeConfig,
  readRuntimeConfig,
  runsDir
} = require("./agent-runtime-adapter");
const { validateFeatureSlug } = require("./scaffold-spec-from-context");
const {
  readRuntimeEvidenceSummary,
  verifyEvidenceDocument
} = require("./run-verification-evidence-gate");

const DEFAULT_BUILDER = "chatgpt-builder";
const DEFAULT_REVIEWER = "codex-reviewer";
const CORE_ARTIFACTS = [
  "agent-delegation.json",
  "agent-task-graph.json",
  "agent-runtime.json"
];
const DOWNSTREAM_ARTIFACTS = [
  "agent-runtime.local.json",
  "reviewer-review.md",
  "security-review.md",
  "verification-evidence.json"
];

const NEXT_ACTIONS = new Map([
  ["builder", {
    phase: "BUILD",
    nextAction: "IMPLEMENT_AND_TEST",
    nextCommands: []
  }],
  ["reviewer", {
    phase: "REVIEW",
    nextAction: "RUN_CONFORMANCE_AND_INDEPENDENT_REVIEW",
    nextCommands: ["npm run impl:conform", "npm run agent:runtime:codex-review"]
  }],
  ["securityReviewer", {
    phase: "SECURITY_REVIEW",
    nextAction: "RUN_INDEPENDENT_SECURITY_REVIEW",
    nextCommands: []
  }],
  ["verification", {
    phase: "VERIFICATION",
    nextAction: "RUN_VERIFICATION_GATE",
    nextCommands: ["npm run verify:gate"]
  }]
]);

const TASK_NAMES = ["builder", "reviewer", "securityReviewer", "verification"];

function validateTaskGraphState(graph) {
  if (!graph.tasks || typeof graph.tasks !== "object" || Array.isArray(graph.tasks)) {
    return ["Task Graph tasks are missing"];
  }

  const taskNames = Object.keys(graph.tasks);
  if (
    taskNames.length !== TASK_NAMES.length ||
    TASK_NAMES.some((taskName) => !Object.hasOwn(graph.tasks, taskName))
  ) {
    return ["Task Graph must contain exactly the supported tasks"];
  }

  const statuses = TASK_NAMES.map((taskName) => graph.tasks[taskName]?.status).join(":");
  const hasSecurityReviewer = Boolean(graph.roles?.securityReviewer);
  const activeStates = hasSecurityReviewer
    ? new Set([
        "READY:BLOCKED:BLOCKED:BLOCKED",
        "PASS:READY:BLOCKED:BLOCKED",
        "PASS:PASS:READY:BLOCKED",
        "PASS:PASS:PASS:READY"
      ])
    : new Set([
        "READY:BLOCKED:SKIPPED:BLOCKED",
        "PASS:READY:SKIPPED:BLOCKED",
        "PASS:PASS:SKIPPED:READY"
      ]);
  const completeState = hasSecurityReviewer
    ? "PASS:PASS:PASS:PASS"
    : "PASS:PASS:SKIPPED:PASS";
  const failedStates = hasSecurityReviewer
    ? new Set([
        "FAIL:BLOCKED:BLOCKED:BLOCKED",
        "PASS:FAIL:BLOCKED:BLOCKED",
        "PASS:PASS:FAIL:BLOCKED",
        "PASS:PASS:PASS:FAIL"
      ])
    : new Set([
        "FAIL:BLOCKED:SKIPPED:BLOCKED",
        "PASS:FAIL:SKIPPED:BLOCKED",
        "PASS:PASS:SKIPPED:FAIL"
      ]);

  const reachable =
    (graph.status === "ACTIVE" && activeStates.has(statuses)) ||
    (graph.status === "COMPLETE" && statuses === completeState) ||
    (graph.status === "FAILED" && failedStates.has(statuses));

  return reachable ? [] : ["Task Graph task statuses are not reachable for graph status " + graph.status];
}

function toSpecDir(repositoryRoot, featureSlug) {
  return path.join(path.resolve(repositoryRoot), ".kiro", "specs", featureSlug);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameRoles(left, right) {
  const normalize = (roles = {}) => ({
    builder: roles.builder || null,
    reviewer: roles.reviewer || null,
    securityReviewer: roles.securityReviewer || null
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function validateHandoff(repositoryRoot, featureSlug, readiness) {
  const handoffPath = path.join(toSpecDir(repositoryRoot, featureSlug), "implementation-handoff.md");
  if (!fs.existsSync(handoffPath)) {
    return { valid: false, error: "implementation-handoff.md is missing", handoffPath };
  }

  const markdown = fs.readFileSync(handoffPath, "utf8");
  const provenance = extractHandoffProvenance(markdown);
  const expectedSpecDir = ".kiro/specs/" + featureSlug;
  const errors = [];

  if (!/^\s*-\s*Spec Readiness:\s*PASS\s*$/mi.test(markdown)) {
    errors.push("Implementation Handoff does not record Spec Readiness PASS");
  }
  if (provenance.sourceContext !== readiness.sourceContext) {
    errors.push("Implementation Handoff Source Context Pack does not match ready Spec");
  }
  if (provenance.contextId !== readiness.contextId) {
    errors.push("Implementation Handoff Context ID does not match ready Spec");
  }
  if (provenance.specDir !== expectedSpecDir) {
    errors.push("Implementation Handoff Spec directory does not match requested feature");
  }

  return {
    valid: errors.length === 0,
    error: errors.join("; "),
    errors,
    handoffPath,
    provenance
  };
}

function inspectArtifactState(repositoryRoot, featureSlug) {
  const specDir = toSpecDir(repositoryRoot, featureSlug);
  const names = [...CORE_ARTIFACTS, ...DOWNSTREAM_ARTIFACTS];
  const present = names.filter((name) => fs.existsSync(path.join(specDir, name)));
  if (fs.existsSync(path.join(specDir, "agent-runs"))) present.push("agent-runs/");
  return {
    present,
    corePresent: CORE_ARTIFACTS.filter((name) => present.includes(name))
  };
}

function getSensitiveAffectedComponents(repositoryRoot, featureSlug) {
  const designPath = path.join(toSpecDir(repositoryRoot, featureSlug), "design.md");
  const affected = parseAffectedComponents(fs.readFileSync(designPath, "utf8"));
  return affected.filter(isSensitivePath);
}

function preflightBootstrap(repositoryRoot, featureSlug, options = {}) {
  validateFeatureSlug(featureSlug);
  const readiness = validateSpecDirectory(repositoryRoot, featureSlug);
  if (!readiness.ready) {
    throw new Error("Spec is not ready: " + readiness.errors.join("; "));
  }

  const handoff = validateHandoff(repositoryRoot, featureSlug, readiness);
  if (!handoff.valid) throw new Error(handoff.error);

  const artifactState = inspectArtifactState(repositoryRoot, featureSlug);
  if (artifactState.present.length > 0) {
    throw new Error(
      "Work orchestration state already exists; refusing to overwrite: " +
      artifactState.present.join(", ")
    );
  }

  const sensitiveComponents = getSensitiveAffectedComponents(repositoryRoot, featureSlug);
  const securityReviewer = String(options.securityReviewer || "").trim() || null;
  if (sensitiveComponents.length > 0 && !securityReviewer) {
    throw new Error(
      "Security Reviewer is required for sensitive Affected Components: " +
      sensitiveComponents.join(", ")
    );
  }

  const maxRetries = options.maxRetries === undefined ? 2 : Number(options.maxRetries);
  const now = options.now || new Date().toISOString();
  const delegation = createDelegationDocument(
    featureSlug,
    options.builder || DEFAULT_BUILDER,
    options.reviewer || DEFAULT_REVIEWER,
    securityReviewer,
    now
  );
  const graph = createInitialGraph(featureSlug, delegation.roles, maxRetries, now);
  const runtime = createRuntimeConfig(featureSlug, graph, now);

  if (!sameRoles(delegation.roles, graph.roles) || !sameRoles(graph.roles, runtime.roles)) {
    throw new Error("generated Work orchestration role provenance is inconsistent");
  }

  return {
    readiness,
    handoff,
    sensitiveComponents,
    delegation,
    graph,
    runtime
  };
}

function bootstrapWorkOrchestration(repositoryRoot, featureSlug, options = {}) {
  const root = path.resolve(repositoryRoot);
  const preflight = preflightBootstrap(root, featureSlug, options);
  const specDir = toSpecDir(root, featureSlug);
  const documents = [
    ["agent-delegation.json", preflight.delegation],
    ["agent-task-graph.json", preflight.graph],
    ["agent-runtime.json", preflight.runtime]
  ];
  const created = [];
  const writeFile = options.writeFile || ((filePath, content) => {
    fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
  });

  try {
    for (const [name, document] of documents) {
      const filePath = path.join(specDir, name);
      writeFile(filePath, JSON.stringify(document, null, 2) + "\n");
      created.push(filePath);
    }

    const runEvidenceDir = runsDir(root, featureSlug);
    fs.mkdirSync(runEvidenceDir);
    created.push(runEvidenceDir);
  } catch (error) {
    for (const createdPath of created.reverse()) {
      try {
        const stat = fs.statSync(createdPath);
        if (stat.isDirectory()) fs.rmdirSync(createdPath);
        else fs.unlinkSync(createdPath);
      } catch {
        // Rollback is best-effort and only targets artifacts created by this invocation.
      }
    }
    throw new Error(
      "Work orchestration bootstrap failed and was rolled back: " + error.message,
      { cause: error }
    );
  }

  return {
    status: "ACTIVE",
    feature: featureSlug,
    phase: "BUILD",
    readyTask: "builder",
    nextAction: "IMPLEMENT_AND_TEST",
    roles: preflight.delegation.roles,
    maxRetries: preflight.graph.maxRetries,
    created: created.map((filePath) => path.relative(root, filePath).split(path.sep).join("/"))
  };
}

function inconsistent(featureSlug, errors, details = {}) {
  return {
    status: "INCONSISTENT",
    feature: featureSlug,
    phase: "BLOCKED",
    readyTask: null,
    nextAction: null,
    nextCommands: [],
    errors,
    ...details
  };
}

function getWorkOrchestrationStatus(repositoryRoot, featureSlug) {
  try {
    validateFeatureSlug(featureSlug);
  } catch (error) {
    return inconsistent(featureSlug, [error.message]);
  }

  const root = path.resolve(repositoryRoot);
  const readiness = validateSpecDirectory(root, featureSlug);
  if (!readiness.ready) {
    return inconsistent(featureSlug, ["Spec is not ready", ...readiness.errors]);
  }

  const handoff = validateHandoff(root, featureSlug, readiness);
  if (!handoff.valid) return inconsistent(featureSlug, handoff.errors.length ? handoff.errors : [handoff.error]);

  const artifactState = inspectArtifactState(root, featureSlug);
  if (artifactState.corePresent.length === 0) {
    if (artifactState.present.length > 0) {
      return inconsistent(featureSlug, [
        "partial Work orchestration state exists without core artifacts: " + artifactState.present.join(", ")
      ]);
    }
    return {
      status: "READY_TO_BOOTSTRAP",
      feature: featureSlug,
      phase: "BOOTSTRAP",
      readyTask: null,
      nextAction: "BOOTSTRAP_WORK_ORCHESTRATION",
      nextCommands: ["npm run work:bootstrap -- " + featureSlug],
      errors: []
    };
  }

  if (artifactState.corePresent.length !== CORE_ARTIFACTS.length) {
    return inconsistent(featureSlug, [
      "partial Work orchestration core state: " + artifactState.corePresent.join(", ")
    ]);
  }

  try {
    const specDir = toSpecDir(root, featureSlug);
    const delegation = readJson(path.join(specDir, "agent-delegation.json"));
    const graph = readJson(path.join(specDir, "agent-task-graph.json"));
    const runtime = readJson(path.join(specDir, "agent-runtime.json"));
    const errors = [];

    for (const [label, document] of [["delegation", delegation], ["Task Graph", graph], ["Runtime", runtime]]) {
      if (document.feature !== featureSlug) errors.push(label + " feature provenance mismatch");
    }
    const roleValidation = validateDelegationRoles(
      delegation.roles?.builder,
      delegation.roles?.reviewer,
      delegation.roles?.securityReviewer
    );
    if (!roleValidation.valid) {
      errors.push(...roleValidation.errors.map((error) => "invalid delegation roles: " + error));
    }
    if (!sameRoles(delegation.roles, graph.roles)) errors.push("delegation and Task Graph roles differ");
    if (!sameRoles(graph.roles, runtime.roles)) errors.push("Task Graph and Runtime roles differ");

    if (graph.tasks?.builder?.actor !== graph.roles?.builder) {
      errors.push("Builder task actor does not match Task Graph role");
    }
    if (graph.tasks?.reviewer?.actor !== graph.roles?.reviewer) {
      errors.push("Reviewer task actor does not match Task Graph role");
    }
    if (graph.roles?.securityReviewer) {
      if (graph.tasks?.securityReviewer?.actor !== graph.roles.securityReviewer) {
        errors.push("Security Reviewer task actor does not match Task Graph role");
      }
    } else if (
      graph.tasks?.securityReviewer?.actor !== null ||
      graph.tasks?.securityReviewer?.status !== "SKIPPED"
    ) {
      errors.push("Undelegated Security Reviewer task must have null actor and SKIPPED status");
    }
    if (graph.tasks?.verification?.actor !== "verification-gate") {
      errors.push("Verification task actor must be verification-gate");
    }

    const committedAdapters = [
      ["builder", runtime.adapters?.builder],
      ["reviewer", runtime.adapters?.reviewer],
      ["securityReviewer", runtime.adapters?.securityReviewer],
      ["verification", runtime.adapters?.verification]
    ];
    for (const [taskName, adapter] of committedAdapters) {
      if (adapter?.type !== "dry-run") {
        errors.push("committed Runtime adapter must remain dry-run: " + taskName);
      }
    }

    try {
      readRuntimeConfig(root, featureSlug);
    } catch (error) {
      errors.push(error.message);
    }
    const runtimeEvidence = readRuntimeEvidenceSummary(root, featureSlug);
    if (!runtimeEvidence.valid) errors.push(runtimeEvidence.error);

    if (!["ACTIVE", "COMPLETE", "FAILED"].includes(graph.status)) {
      errors.push("unsupported Task Graph status: " + graph.status);
    }
    errors.push(...validateTaskGraphState(graph));

    const readyTasks = graph.tasks
      ? Object.entries(graph.tasks)
          .filter(([, task]) => task?.status === "READY")
          .map(([taskName]) => taskName)
      : [];

    if (graph.status === "ACTIVE" && readyTasks.length !== 1) {
      errors.push("ACTIVE Task Graph must have exactly one READY task");
    }
    if (graph.status !== "ACTIVE" && readyTasks.length !== 0) {
      errors.push("terminal Task Graph must not have READY tasks");
    }

    const evidencePath = path.join(specDir, "verification-evidence.json");
    const hasEvidence = fs.existsSync(evidencePath);
    let verificationEvidence = null;
    if (hasEvidence) {
      verificationEvidence = readJson(evidencePath);
      if (!verifyEvidenceDocument(verificationEvidence)) {
        errors.push("Verification Evidence digest is invalid");
      } else if (
        verificationEvidence.payload?.feature !== featureSlug ||
        verificationEvidence.payload?.status !== "PASS"
      ) {
        errors.push("Verification Evidence must be a matching PASS artifact");
      }
    }
    if (graph.status === "COMPLETE") {
      if (!hasEvidence) {
        errors.push("COMPLETE Task Graph requires verification-evidence.json");
      }
    }

    if (errors.length > 0) return inconsistent(featureSlug, errors, { roles: delegation.roles });

    if (graph.status === "COMPLETE") {
      return {
        status: "COMPLETE",
        feature: featureSlug,
        phase: "HUMAN_DECISION",
        readyTask: null,
        nextAction: "HUMAN_MERGE_DECISION",
        nextCommands: [],
        errors: [],
        roles: delegation.roles,
        runtimeRuns: runtimeEvidence.summary,
        retryCount: graph.retryCount,
        maxRetries: graph.maxRetries
      };
    }

    if (graph.status === "FAILED") {
      return {
        status: "FAILED",
        feature: featureSlug,
        phase: "HUMAN_INTERVENTION",
        readyTask: null,
        nextAction: "HUMAN_INTERVENTION",
        nextCommands: [],
        errors: [],
        roles: delegation.roles,
        runtimeRuns: runtimeEvidence.summary,
        retryCount: graph.retryCount,
        maxRetries: graph.maxRetries
      };
    }

    const readyTask = readyTasks[0];
    const action = NEXT_ACTIONS.get(readyTask);
    if (!action) return inconsistent(featureSlug, ["unsupported READY task: " + readyTask]);

    const nextCommands = action.nextCommands.map((command) => command + " -- " + featureSlug);
    if (readyTask === "verification" && hasEvidence) {
      nextCommands.splice(0, nextCommands.length, "npm run agent:graph:event -- " + featureSlug + " verify-pass");
    }

    return {
      status: "ACTIVE",
      feature: featureSlug,
      phase: action.phase,
      readyTask,
      nextAction: readyTask === "verification" && hasEvidence
        ? "RECORD_VERIFICATION_RESULT"
        : action.nextAction,
      nextCommands,
      errors: [],
      roles: delegation.roles,
      runtimeRuns: runtimeEvidence.summary,
      retryCount: graph.retryCount,
      maxRetries: graph.maxRetries
    };
  } catch (error) {
    return inconsistent(featureSlug, ["invalid Work orchestration artifact: " + error.message]);
  }
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const [mode, featureSlug, securityReviewer, maxRetries] = process.argv.slice(2);

  if (!mode || !featureSlug || !["bootstrap", "status"].includes(mode)) {
    console.error(
      "Usage: node scripts/work-development-orchestrator.js <bootstrap|status> <feature-slug> [security-reviewer-id] [max-retries]"
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = mode === "bootstrap"
      ? bootstrapWorkOrchestration(repositoryRoot, featureSlug, { securityReviewer, maxRetries })
      : getWorkOrchestrationStatus(repositoryRoot, featureSlug);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "INCONSISTENT") process.exitCode = 1;
  } catch (error) {
    console.error("Work development orchestration failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  CORE_ARTIFACTS,
  DEFAULT_BUILDER,
  DEFAULT_REVIEWER,
  bootstrapWorkOrchestration,
  getSensitiveAffectedComponents,
  getWorkOrchestrationStatus,
  inspectArtifactState,
  preflightBootstrap,
  sameRoles,
  validateHandoff
};
