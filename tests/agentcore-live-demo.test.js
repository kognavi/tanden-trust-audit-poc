"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../fixtures/agentcore-live-response.json");
const { AgentCoreLiveDemoError, runAgentCoreLiveDemo } = require("../lib/agentcore-live-demo");

const invocation = {
  runtimeArn: "arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/portfolio-demo",
  runtimeSessionId: fixture.auditEvent.execution.sessionId,
  traceId: fixture.auditEvent.execution.traceId,
  qualifier: "DEFAULT",
  region: "ap-northeast-1",
};

test("AgentCore live demo proves original PASS and tampered FAIL", async () => {
  const summary = await runAgentCoreLiveDemo({ runtimeResponse: fixture, ...invocation });
  assert.equal(summary.source, "amazon-bedrock-agentcore");
  assert.equal(summary.evidenceId, fixture.auditEvent.evidenceId);
  assert.equal(summary.toolName, fixture.auditEvent.action.toolName);
  assert.equal(summary.verification.original, "PASS");
  assert.equal(summary.verification.tampered, "FAIL");
  assert.equal(summary.dataMinimization.rawRuntimeResponsePersisted, false);
  assert.equal(summary.dataMinimization.containsSecrets, false);
  assert.equal(summary.awsWritesPerformedByProcessor, false);
  assert.match(summary.runtimeArnSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(summary).includes("123456789012"), false);
});

test("portfolio live demo refuses personal-data-bearing events", async () => {
  const runtimeResponse = structuredClone(fixture);
  runtimeResponse.auditEvent.metadata.containsPersonalData = true;
  await assert.rejects(
    () => runAgentCoreLiveDemo({ runtimeResponse, ...invocation }),
    (error) => {
      assert.ok(error instanceof AgentCoreLiveDemoError);
      assert.equal(error.code, "LIVE_DEMO_PERSONAL_DATA_NOT_ALLOWED");
      return true;
    }
  );
});
