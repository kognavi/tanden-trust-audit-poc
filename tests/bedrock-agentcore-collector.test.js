"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../fixtures/agentcore-live-response.json");
const {
  BedrockAgentCoreCollector,
  BedrockAgentCoreCollectorError,
  parseRuntimeResponse,
} = require("../lib/collectors/bedrock-agentcore-collector");

const sessionId = fixture.auditEvent.execution.sessionId;
const traceId = fixture.auditEvent.execution.traceId;

test("AgentCore collector extracts only the normalized auditEvent", async () => {
  const collector = new BedrockAgentCoreCollector({
    runtimeResponse: JSON.stringify(fixture),
    expectedRuntimeSessionId: sessionId,
    expectedTraceId: traceId,
  });
  const event = await collector.collect();
  assert.deepEqual(event, fixture.auditEvent);
  assert.equal(event.result, undefined);
  assert.equal(JSON.stringify(event).includes(fixture.result), false);
});

test("AgentCore collector accepts Buffer responses", () => {
  const parsed = parseRuntimeResponse(Buffer.from(JSON.stringify(fixture), "utf8"));
  assert.equal(parsed.auditEvent.evidenceId, fixture.auditEvent.evidenceId);
});

test("AgentCore collector rejects non-JSON responses", async () => {
  const collector = new BedrockAgentCoreCollector({ runtimeResponse: "not-json" });
  await assert.rejects(() => collector.collect(), (error) => {
    assert.ok(error instanceof BedrockAgentCoreCollectorError);
    assert.equal(error.code, "AGENTCORE_RESPONSE_NOT_JSON");
    return true;
  });
});

test("AgentCore collector binds evidence to the invoked runtime session", async () => {
  const collector = new BedrockAgentCoreCollector({
    runtimeResponse: fixture,
    expectedRuntimeSessionId: "different-session-id-000000000000000000",
    expectedTraceId: traceId,
  });
  await assert.rejects(() => collector.collect(), (error) => {
    assert.equal(error.code, "AGENTCORE_SESSION_MISMATCH");
    return true;
  });
});

test("AgentCore collector binds evidence to the invocation trace", async () => {
  const collector = new BedrockAgentCoreCollector({
    runtimeResponse: fixture,
    expectedRuntimeSessionId: sessionId,
    expectedTraceId: "trace-different",
  });
  await assert.rejects(() => collector.collect(), (error) => {
    assert.equal(error.code, "AGENTCORE_TRACE_MISMATCH");
    return true;
  });
});
