"use strict";

const { assertNormalizedAgentEvent } = require("../normalized-agent-event");

class BedrockAgentCoreCollectorError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "BedrockAgentCoreCollectorError";
    this.code = code;
  }
}

function parseRuntimeResponse(runtimeResponse) {
  if (Buffer.isBuffer(runtimeResponse)) {
    runtimeResponse = runtimeResponse.toString("utf8");
  }

  if (typeof runtimeResponse === "string") {
    try {
      runtimeResponse = JSON.parse(runtimeResponse);
    } catch (cause) {
      throw new BedrockAgentCoreCollectorError(
        "AGENTCORE_RESPONSE_NOT_JSON",
        "AgentCore Runtime response must be valid JSON.",
        { cause }
      );
    }
  }

  if (runtimeResponse === null || typeof runtimeResponse !== "object" || Array.isArray(runtimeResponse)) {
    throw new BedrockAgentCoreCollectorError(
      "AGENTCORE_RESPONSE_INVALID",
      "AgentCore Runtime response must be a JSON object."
    );
  }

  return runtimeResponse;
}

class BedrockAgentCoreCollector {
  constructor({ runtimeResponse, expectedRuntimeSessionId, expectedTraceId } = {}) {
    if (runtimeResponse === undefined) {
      throw new BedrockAgentCoreCollectorError(
        "AGENTCORE_RESPONSE_REQUIRED",
        "BedrockAgentCoreCollector requires a runtimeResponse."
      );
    }
    this._runtimeResponse = runtimeResponse;
    this._expectedRuntimeSessionId = expectedRuntimeSessionId;
    this._expectedTraceId = expectedTraceId;
  }

  async collect() {
    const response = parseRuntimeResponse(this._runtimeResponse);
    const auditEvent = response.auditEvent;

    if (auditEvent === null || typeof auditEvent !== "object" || Array.isArray(auditEvent)) {
      throw new BedrockAgentCoreCollectorError(
        "AGENTCORE_AUDIT_EVENT_MISSING",
        "AgentCore Runtime response must contain an auditEvent object."
      );
    }

    assertNormalizedAgentEvent(auditEvent);

    if (this._expectedRuntimeSessionId && auditEvent.execution.sessionId !== this._expectedRuntimeSessionId) {
      throw new BedrockAgentCoreCollectorError(
        "AGENTCORE_SESSION_MISMATCH",
        "auditEvent.execution.sessionId does not match the invoked AgentCore Runtime session."
      );
    }

    if (this._expectedTraceId && auditEvent.execution.traceId !== this._expectedTraceId) {
      throw new BedrockAgentCoreCollectorError(
        "AGENTCORE_TRACE_MISMATCH",
        "auditEvent.execution.traceId does not match the AgentCore invocation trace ID."
      );
    }

    return structuredClone(auditEvent);
  }
}

module.exports = {
  BedrockAgentCoreCollector,
  BedrockAgentCoreCollectorError,
  parseRuntimeResponse,
};
