"use strict";

const { assertNormalizedAgentEvent } = require("../normalized-agent-event");
const { isDeepStrictEqual } = require("node:util");
const { FIXED_INPUT_SHA256, createAuditEvent } = require("../../lambda/loop017b/handler");

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;
const SOURCE = "aws-lambda-bedrock-nova-loop017b";
const MODEL_ID = "jp.amazon.nova-2-lite-v1:0";

class LambdaNovaCollectorError extends Error {
  constructor(code) {
    super(code);
    this.name = "LambdaNovaCollectorError";
    this.code = code;
  }
}

function objectHasKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function parseLambdaResponse(value) {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new LambdaNovaCollectorError("RESPONSE_NOT_JSON");
    }
  }
  if (!objectHasKeys(value, [
    "schemaVersion", "source", "runId", "lambdaRequestId", "bedrockRequestId",
    "region", "modelId", "fixedInputSha256", "codeSha256", "occurredAt", "usage", "auditEvent",
  ])) {
    throw new LambdaNovaCollectorError("RESPONSE_ENVELOPE_INVALID");
  }
  return value;
}

class LambdaNovaCollector {
  constructor({ lambdaResponse, expectedRunId } = {}) {
    if (lambdaResponse === undefined || !RUN_ID_PATTERN.test(expectedRunId ?? "")) {
      throw new LambdaNovaCollectorError("EXPECTED_INVOCATION_REQUIRED");
    }
    this._lambdaResponse = lambdaResponse;
    this._expectedRunId = expectedRunId;
    this._validatedReceipt = null;
  }

  async collect() {
    const response = parseLambdaResponse(this._lambdaResponse);
    if (response.schemaVersion !== "1.0.0" || response.source !== SOURCE ||
        response.region !== "ap-northeast-1" || response.modelId !== MODEL_ID ||
        response.runId !== this._expectedRunId ||
        !REQUEST_ID_PATTERN.test(response.lambdaRequestId ?? "") ||
        !REQUEST_ID_PATTERN.test(response.bedrockRequestId ?? "") ||
        response.fixedInputSha256 !== FIXED_INPUT_SHA256 ||
        !SHA256_PATTERN.test(response.codeSha256 ?? "") ||
        !Number.isFinite(Date.parse(response.occurredAt)) ||
        !objectHasKeys(response.usage, ["inputTokens", "outputTokens", "totalTokens"]) ||
        !Number.isSafeInteger(response.usage.inputTokens) || response.usage.inputTokens < 0 ||
        !Number.isSafeInteger(response.usage.outputTokens) || response.usage.outputTokens < 0 ||
        !Number.isSafeInteger(response.usage.totalTokens) || response.usage.totalTokens < 0) {
      throw new LambdaNovaCollectorError("RECEIPT_INVALID");
    }

    const event = response.auditEvent;
    assertNormalizedAgentEvent(event);
    if (event.metadata.containsPersonalData || event.metadata.containsSecrets) {
      throw new LambdaNovaCollectorError("SENSITIVE_EVENT_REJECTED");
    }
    const expectedEvent = createAuditEvent({
      runId: response.runId,
      lambdaRequestId: response.lambdaRequestId,
      occurredAt: response.occurredAt,
    });
    if (!isDeepStrictEqual(event, expectedEvent)) {
      throw new LambdaNovaCollectorError("AUDIT_EVENT_CORRELATION_INVALID");
    }
    this._validatedReceipt = {
      runId: response.runId,
      lambdaRequestId: response.lambdaRequestId,
      bedrockRequestId: response.bedrockRequestId,
      region: response.region,
      modelId: response.modelId,
      fixedInputSha256: response.fixedInputSha256,
      codeSha256: response.codeSha256,
      occurredAt: response.occurredAt,
      usage: structuredClone(response.usage),
    };
    return structuredClone(event);
  }

  receipt() {
    if (!this._validatedReceipt) throw new LambdaNovaCollectorError("RECEIPT_NOT_VALIDATED");
    return structuredClone(this._validatedReceipt);
  }
}

module.exports = { LambdaNovaCollector, LambdaNovaCollectorError, parseLambdaResponse };
