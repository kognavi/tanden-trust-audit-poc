"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../fixtures/agentcore-live-response.json");
const { BedrockAgentCoreCollector } = require("../lib/collectors/bedrock-agentcore-collector");
const { mapNormalizedAgentEventToEvidence } = require("../lib/ai-agent-evidence-mapper");
const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { EvidenceProcessingService } = require("../lib/evidence-processing-service");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");
const {
  AgentCoreDemoEvidenceStore,
  AgentCoreLiveDemoError,
  runAgentCoreLiveDemo,
  verifyReloadedEvidenceRecord,
} = require("../lib/agentcore-live-demo");

const invocation = {
  runtimeArn: "arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/portfolio-demo",
  runtimeSessionId: fixture.auditEvent.execution.sessionId,
  traceId: fixture.auditEvent.execution.traceId,
  qualifier: "DEFAULT",
  region: "ap-northeast-1",
};

test("AgentCore live demo proves Store reload PASS and tampered FAIL after Ledger", async () => {
  const summary = await runAgentCoreLiveDemo({ runtimeResponse: fixture, ...invocation });
  assert.equal(summary.source, "amazon-bedrock-agentcore");
  assert.equal(summary.evidenceId, fixture.auditEvent.evidenceId);
  assert.equal(summary.toolName, fixture.auditEvent.action.toolName);
  assert.deepEqual(summary.processingStages, [
    "store",
    "ledger",
    "reload",
    "verify-reloaded",
    "verify-tampered",
  ]);
  assert.equal(summary.verification.reloaded, "PASS");
  assert.equal(summary.verification.tampered, "FAIL");
  assert.equal(summary.dataMinimization.rawRuntimeResponsePersisted, false);
  assert.equal(summary.dataMinimization.containsSecrets, false);
  assert.equal(summary.awsWritesPerformedByProcessor, false);
  assert.match(summary.runtimeArnSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(summary).includes("123456789012"), false);
  assert.equal(JSON.stringify(summary).includes(fixture.result), false);
  assert.equal(JSON.stringify(summary).includes("PRIVATE KEY"), false);
});

test("AgentCore live event preserves canonical actor, agent, model, policy, tool, approval, and side-effect mapping", async () => {
  const collector = new BedrockAgentCoreCollector({
    runtimeResponse: fixture,
    expectedRuntimeSessionId: invocation.runtimeSessionId,
    expectedTraceId: invocation.traceId,
  });
  const normalizedEvent = await collector.collect();
  const evidence = mapNormalizedAgentEventToEvidence(normalizedEvent);
  const provider = new LocalEcdsaProvider();
  const { privateKey } = provider.generateEcKeyPair();
  const store = new AgentCoreDemoEvidenceStore();
  const service = new EvidenceProcessingService({
    schema: evidenceSchema,
    signingProvider: provider,
    evidenceStore: store,
    pgLogger: { async appendEvent() { return { eventId: "ledger-mapping-test" }; } },
  });
  const result = await service.processEvidence(evidence, { version: 1, privateKeyPem: privateKey });
  const reloaded = await store.getEvidenceVersion(result.evidenceId, result.version);

  for (const field of [
    "actor",
    "agent",
    "model",
    "execution",
    "policy",
    "action",
    "approval",
    "sideEffect",
    "contextReferences",
    "artifacts",
    "metadata",
  ]) {
    assert.deepEqual(reloaded.evidence[field], fixture.auditEvent[field]);
  }
  assert.equal(reloaded.evidence.result, undefined);
  assert.equal(reloaded.evidence.prompt, undefined);
});

test("local demo Store is append-only and returns defensive reload clones", async () => {
  const stages = [];
  const store = new AgentCoreDemoEvidenceStore({ stageTrace: stages });
  const input = {
    evidenceId: fixture.auditEvent.evidenceId,
    version: 1,
    evidence: fixture.auditEvent,
    digestHex: "a".repeat(64),
    signature: "c2lnbmF0dXJl",
    kmsKeyId: null,
  };

  await store.appendEvidence(input);
  const first = await store.getEvidenceVersion(input.evidenceId, input.version);
  first.evidence.action.target = "synthetic://tampered";
  const second = await store.getEvidenceVersion(input.evidenceId, input.version);

  assert.equal(second.evidence.action.target, fixture.auditEvent.action.target);
  assert.deepEqual(stages, ["store", "reload", "reload"]);
  await assert.rejects(() => store.appendEvidence(input), (error) => {
    assert.equal(error.code, "LIVE_DEMO_EVIDENCE_VERSION_EXISTS");
    return true;
  });
});

test("reload verification fails closed for missing, mismatched, or tampered records", async (t) => {
  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();
  const evidence = mapNormalizedAgentEventToEvidence(fixture.auditEvent);
  const signed = await provider.signEvidence(evidence, privateKey);
  const processResult = {
    evidenceId: evidence.evidenceId,
    version: 1,
    digest: signed.digestHex,
  };
  const record = {
    evidenceId: evidence.evidenceId,
    version: 1,
    digestHex: signed.digestHex,
    evidence,
    signature: signed.signatureBase64,
  };

  await t.test("missing", async () => {
    await assert.rejects(
      () => verifyReloadedEvidenceRecord({ record: null, processResult, provider, publicKey }),
      (error) => error.code === "LIVE_DEMO_RELOAD_MISSING"
    );
  });

  for (const [name, mutate, code] of [
    ["identity", (value) => { value.evidenceId = "evd-2026-999999"; }, "LIVE_DEMO_RELOAD_IDENTITY_MISMATCH"],
    ["digest metadata", (value) => { value.digestHex = "0".repeat(64); }, "LIVE_DEMO_RELOAD_IDENTITY_MISMATCH"],
    ["Evidence", (value) => { value.evidence.action.target += "#tampered"; }, "LIVE_DEMO_RELOAD_VERIFICATION_FAILED"],
    ["signature", (value) => { value.signature = Buffer.alloc(64).toString("base64"); }, "LIVE_DEMO_RELOAD_VERIFICATION_FAILED"],
  ]) {
    await t.test(name, async () => {
      const candidate = structuredClone(record);
      mutate(candidate);
      await assert.rejects(
        () => verifyReloadedEvidenceRecord({ record: candidate, processResult, provider, publicKey }),
        (error) => error.code === code
      );
    });
  }
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

test("portfolio live demo refuses secret-bearing events", async () => {
  const runtimeResponse = structuredClone(fixture);
  runtimeResponse.auditEvent.metadata.containsSecrets = true;
  await assert.rejects(
    () => runAgentCoreLiveDemo({ runtimeResponse, ...invocation }),
    (error) => {
      assert.equal(error.code, "NORMALIZED_AGENT_EVENT_INVALID");
      return true;
    }
  );
});
