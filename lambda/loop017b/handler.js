"use strict";

const crypto = require("node:crypto");
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");

const REGION = "ap-northeast-1";
const MODEL_ID = "jp.amazon.nova-2-lite-v1:0";
const TOOL_NAME = "record_synthetic_noop";
const TARGET = "synthetic://loop-017b/resource/demo-1";
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const REQUEST = Object.freeze({
  modelId: MODEL_ID,
  messages: [
    {
      role: "user",
      content: [{ text: "Request the synthetic audit no-op tool once for the fixed demo resource. Use no real data." }],
    },
  ],
  toolConfig: {
    tools: [{
      toolSpec: {
        name: TOOL_NAME,
        description: "Record a synthetic no-op tool request. It changes no external resource.",
        inputSchema: {
          json: {
            type: "object",
            additionalProperties: false,
            properties: {
              target: { type: "string", enum: [TARGET] },
              operation: { type: "string", enum: ["NO_OP"] },
            },
            required: ["target", "operation"],
          },
        },
      },
    }],
    toolChoice: { tool: { name: TOOL_NAME } },
  },
  inferenceConfig: { maxTokens: 128, temperature: 0.00001 },
});
const FIXED_INPUT_SHA256 = crypto.createHash("sha256").update(JSON.stringify(REQUEST)).digest("hex");

class Loop017BLambdaError extends Error {
  constructor(code, correlation) {
    const suffix = correlation
      ? ` runId=${correlation.runId} lambdaRequestId=${correlation.lambdaRequestId}`
      : "";
    super(`${code}${suffix}`);
    this.name = "Loop017BLambdaError";
    this.code = code;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, expected) {
  return isPlainObject(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}

function assertInvocation(event, context, codeSha256) {
  if (!hasOnlyKeys(event, ["runId"]) || !RUN_ID_PATTERN.test(event.runId)) {
    throw new Loop017BLambdaError("INVALID_FIXED_INVOCATION");
  }
  if (!RUN_ID_PATTERN.test(context?.awsRequestId ?? "")) {
    throw new Loop017BLambdaError("LAMBDA_REQUEST_ID_INVALID");
  }
  if (!SHA256_PATTERN.test(codeSha256 ?? "")) {
    throw new Loop017BLambdaError("CODE_DIGEST_INVALID");
  }
}

function validateToolUse(response) {
  const content = response?.output?.message?.content;
  if (response?.stopReason !== "tool_use" || !Array.isArray(content) || content.length !== 1) {
    throw new Loop017BLambdaError("EXPECTED_ONE_TOOL_USE");
  }
  const toolUse = content[0]?.toolUse;
  if (!hasOnlyKeys(content[0], ["toolUse"]) ||
      !isPlainObject(toolUse) || toolUse.name !== TOOL_NAME ||
      !hasOnlyKeys(toolUse.input, ["target", "operation"]) ||
      toolUse.input.target !== TARGET || toolUse.input.operation !== "NO_OP") {
    throw new Loop017BLambdaError("UNEXPECTED_TOOL_USE");
  }
  return toolUse;
}

function validateBedrockReceipt(response) {
  const requestId = response?.$metadata?.requestId;
  const usage = response?.usage;
  if (!REQUEST_ID_PATTERN.test(requestId ?? "") ||
      response.$metadata.httpStatusCode !== 200 || !isPlainObject(usage) ||
      !Number.isSafeInteger(usage.inputTokens) || usage.inputTokens < 0 ||
      !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens < 0 ||
      !Number.isSafeInteger(usage.totalTokens) || usage.totalTokens < 0) {
    throw new Loop017BLambdaError("BEDROCK_RECEIPT_INVALID");
  }
  return {
    requestId,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    },
  };
}

function createAuditEvent({ runId, lambdaRequestId, occurredAt }) {
  const evidenceSuffix = String(parseInt(crypto.createHash("sha256").update(runId).digest("hex").slice(0, 10), 16) % 1000000).padStart(6, "0");
  return {
    evidenceId: `evd-2026-${evidenceSuffix}`,
    eventType: "AGENT_TOOL_CALL",
    occurredAt,
    sourceSystem: "aws-lambda-bedrock-nova-loop017b",
    actor: { type: "service", id: "loop017b-manual-demo", principalRef: "synthetic:principal/loop017b" },
    agent: {
      agentId: "loop017b-lambda-wrapper",
      agentVersion: "1.0.0",
      framework: "lambda-converse-demo",
      promptConfigDigestSha256: FIXED_INPUT_SHA256,
    },
    model: { provider: "aws-bedrock", modelId: MODEL_ID, modelVersion: "v1:0" },
    execution: {
      traceId: `trace-${runId}`,
      sessionId: runId,
      taskId: `lambda-${lambdaRequestId}`,
    },
    policy: { policyId: "loop017b-fixed-noop", policyVersion: "1.0.0", decision: "allow", reasonCode: "FIXED_SYNTHETIC_TARGET" },
    action: { toolName: TOOL_NAME, operation: "EXECUTE", target: TARGET },
    approval: { required: false, status: "not_required" },
    sideEffect: { category: "NONE", resource: TARGET, outcome: "SUCCESS" },
    contextReferences: [{ type: "INPUT", reference: "synthetic://loop-017b/fixed-input/v1", digestSha256: FIXED_INPUT_SHA256 }],
    artifacts: [],
    metadata: {
      environment: "demo",
      containsPersonalData: false,
      containsSecrets: false,
      retentionClass: "demo-30d",
      notes: "Synthetic no-op observed by the Lambda wrapper; no external resource was changed.",
    },
  };
}

function createBedrockClient() {
  // One SDK attempt per synchronous Lambda invocation; never retry an ambiguous model call.
  return new BedrockRuntimeClient({ region: REGION, maxAttempts: 1 });
}

function logStatus(logger, status, runId, lambdaRequestId, bedrockRequestId) {
  logger.info(JSON.stringify({
    event: "loop017b.inference",
    status,
    runId,
    lambdaRequestId,
    ...(bedrockRequestId ? { bedrockRequestId } : {}),
  }));
}

function createHandler({ client, logger = console, now = () => new Date(), codeSha256 = process.env.LOOP017B_CODE_SHA256 } = {}) {
  const bedrock = client ?? createBedrockClient();
  return async function handler(event, context) {
    assertInvocation(event, context, codeSha256);
    const correlation = { runId: event.runId, lambdaRequestId: context.awsRequestId };
    try {
      logStatus(logger, "ATTEMPTING", correlation.runId, correlation.lambdaRequestId);
    } catch {
      // An unlogged attempt cannot be reconciled safely after a Lambda timeout.
      throw new Loop017BLambdaError("PRECALL_CORRELATION_LOG_FAILED", correlation);
    }
    let response;
    try {
      response = await bedrock.send(new ConverseCommand(structuredClone(REQUEST)));
    } catch {
      try {
        logStatus(logger, "INDETERMINATE", correlation.runId, correlation.lambdaRequestId);
      } catch {
        // The sanitized error still carries both IDs for Lambda's error record.
      }
      throw new Loop017BLambdaError("BEDROCK_RESULT_INDETERMINATE", correlation);
    }
    validateToolUse(response);
    const bedrockReceipt = validateBedrockReceipt(response);
    const occurredAt = now().toISOString();
    const result = {
      schemaVersion: "1.0.0",
      source: "aws-lambda-bedrock-nova-loop017b",
      runId: event.runId,
      lambdaRequestId: context.awsRequestId,
      bedrockRequestId: bedrockReceipt.requestId,
      region: REGION,
      modelId: MODEL_ID,
      fixedInputSha256: FIXED_INPUT_SHA256,
      codeSha256,
      occurredAt,
      usage: bedrockReceipt.usage,
      auditEvent: createAuditEvent({ runId: event.runId, lambdaRequestId: context.awsRequestId, occurredAt }),
    };
    try {
      logStatus(logger, "SUCCESS", result.runId, result.lambdaRequestId, result.bedrockRequestId);
    } catch {
      // Logging must not turn a successful inference into an ambiguous retry candidate.
    }
    return result;
  };
}

// Constructing the client does not make an AWS API call. The exported handler is invoked only by Lambda.
const handler = createHandler();

module.exports = {
  handler,
  createHandler,
  createBedrockClient,
  createAuditEvent,
  Loop017BLambdaError,
  REGION,
  MODEL_ID,
  TOOL_NAME,
  TARGET,
  FIXED_INPUT_SHA256,
};
