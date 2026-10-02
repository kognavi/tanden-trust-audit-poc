"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LambdaNovaCollector, LambdaNovaCollectorError } = require("../lib/collectors/lambda-nova-collector");
const { mapNormalizedAgentEventToEvidence } = require("../lib/ai-agent-evidence-mapper");
const { EvidenceProcessingService } = require("../lib/evidence-processing-service");
const { runLambdaNovaLiveDemo } = require("../lib/lambda-nova-live-demo");
const { RUN_ID, lambdaResponse } = require("./helpers/loop017b-response");

test("collector validates and maps the full wrapper-observed event", async () => {
  const { response } = await lambdaResponse();
  const event = await new LambdaNovaCollector({ lambdaResponse: response, expectedRunId: RUN_ID }).collect();
  const evidence = mapNormalizedAgentEventToEvidence(event);
  for (const field of [
    "actor", "agent", "model", "execution", "policy", "action", "approval",
    "sideEffect", "contextReferences", "artifacts", "metadata",
  ]) assert.deepEqual(evidence[field], response.auditEvent[field]);
  assert.equal(evidence.prompt, undefined);
  assert.equal(evidence.result, undefined);
});

test("collector rejects raw fields, PII, and correlation drift", async () => {
  const variants = [
    (r) => { r.rawModelOutput = "secret"; },
    (r) => { r.runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; },
    (r) => { r.auditEvent.execution.traceId = "trace-other"; },
    (r) => { r.auditEvent.execution.taskId = "lambda-other"; },
    (r) => { r.auditEvent.model.modelId = "different-model"; },
    (r) => { r.fixedInputSha256 = "b".repeat(64); r.auditEvent.agent.promptConfigDigestSha256 = r.fixedInputSha256; },
    (r) => { r.auditEvent.contextReferences[0].digestSha256 = "b".repeat(64); },
    (r) => { r.auditEvent.policy.decision = "deny"; },
    (r) => { r.auditEvent.action.operation = "EXTERNAL_WRITE"; },
    (r) => { r.auditEvent.metadata.containsPersonalData = true; },
    (r) => { r.auditEvent.metadata.containsSecrets = true; },
  ];
  for (const mutate of variants) {
    const { response } = await lambdaResponse();
    mutate(response);
    await assert.rejects(
      () => new LambdaNovaCollector({ lambdaResponse: response, expectedRunId: RUN_ID }).collect(),
      (error) => error instanceof LambdaNovaCollectorError || error.code === "NORMALIZED_AGENT_EVENT_INVALID"
    );
  }
});

test("collector rejects secret or raw output in every free-form Evidence field", async () => {
  const variants = [
    (r) => { r.auditEvent.metadata.notes = "RAW_MODEL_SECRET_SENTINEL"; },
    (r) => { r.auditEvent.metadata.retentionClass = "RAW_MODEL_SECRET_SENTINEL"; },
    (r) => { r.auditEvent.model.modelVersion = "RAW_MODEL_SECRET_SENTINEL"; },
    (r) => { r.auditEvent.actor.id = "RAW_MODEL_SECRET_SENTINEL"; },
    (r) => { r.auditEvent.policy.reasonCode = "RAW_MODEL_SECRET_SENTINEL"; },
    (r) => { r.auditEvent.contextReferences[0].reference = "RAW_MODEL_SECRET_SENTINEL"; },
  ];
  const originalProcessEvidence = EvidenceProcessingService.prototype.processEvidence;
  let processCalls = 0;
  EvidenceProcessingService.prototype.processEvidence = async function () { processCalls += 1; };
  try {
    for (const mutate of variants) {
      const { response } = await lambdaResponse();
      mutate(response);
      await assert.rejects(
        () => new LambdaNovaCollector({ lambdaResponse: response, expectedRunId: RUN_ID }).collect(),
        (error) => error.code === "AUDIT_EVENT_CORRELATION_INVALID"
      );
      await assert.rejects(
        () => runLambdaNovaLiveDemo({ lambdaResponse: response, expectedRunId: RUN_ID }),
        (error) => error.code === "AUDIT_EVENT_CORRELATION_INVALID"
      );
    }
    assert.equal(processCalls, 0);
  } finally {
    EvidenceProcessingService.prototype.processEvidence = originalProcessEvidence;
  }
});
