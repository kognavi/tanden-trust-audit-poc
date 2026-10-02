"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runLambdaNovaLiveDemo, LambdaNovaDemoEvidenceStore, verifyReloadedRecord } = require("../lib/lambda-nova-live-demo");
const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { mapNormalizedAgentEventToEvidence } = require("../lib/ai-agent-evidence-mapper");
const { RUN_ID, lambdaResponse } = require("./helpers/loop017b-response");

test("local live-demo path signs, stores, ledgers, reloads, and detects tampering", async () => {
  const { response } = await lambdaResponse();
  const summary = await runLambdaNovaLiveDemo({ lambdaResponse: response, expectedRunId: RUN_ID });
  assert.deepEqual(summary.processingStages, ["store", "ledger", "reload", "verify-reloaded", "verify-tampered"]);
  assert.deepEqual(summary.verification, { reloaded: "PASS", tampered: "FAIL" });
  assert.equal(summary.storeType, "local-demo-memory");
  assert.equal(summary.ledgerType, "local-demo-double");
  assert.equal(summary.awsWritesPerformedByProcessor, false);
  assert.equal(summary.sideEffectCategory, "NONE");
  assert.equal(summary.digestSha256.length, 64);
  assert.equal(JSON.stringify(summary).includes("PRIVATE KEY"), false);
  assert.equal(JSON.stringify(summary).includes("synthetic://loop-017b/resource/demo-1"), false);
});

test("local Store rejects duplicate versions and reloads defensive clones", async () => {
  const { response } = await lambdaResponse();
  const store = new LambdaNovaDemoEvidenceStore();
  const evidence = mapNormalizedAgentEventToEvidence(response.auditEvent);
  const input = {
    evidenceId: evidence.evidenceId, version: 1, evidence,
    digestHex: "a".repeat(64), signature: "c2lnbmF0dXJl", kmsKeyId: null,
  };
  await store.appendEvidence(input);
  const first = await store.getEvidenceVersion(evidence.evidenceId, 1);
  first.evidence.action.target = "tampered";
  const second = await store.getEvidenceVersion(evidence.evidenceId, 1);
  assert.equal(second.evidence.action.target, evidence.action.target);
  await assert.rejects(() => store.appendEvidence(input), (error) => error.code === "EVIDENCE_VERSION_EXISTS");
});

test("reload verification rejects missing and tampered records", async () => {
  const { response } = await lambdaResponse();
  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();
  const evidence = mapNormalizedAgentEventToEvidence(response.auditEvent);
  const signed = await provider.signEvidence(evidence, privateKey);
  const processResult = { evidenceId: evidence.evidenceId, version: 1, digest: signed.digestHex };
  const record = {
    evidenceId: evidence.evidenceId, version: 1, digestHex: signed.digestHex,
    evidence, signature: signed.signatureBase64,
  };
  await assert.rejects(() => verifyReloadedRecord({ record: null, processResult, provider, publicKey }),
    (error) => error.code === "RELOAD_MISSING");
  const modified = structuredClone(record);
  modified.evidence.action.target += "#tampered";
  await assert.rejects(() => verifyReloadedRecord({ record: modified, processResult, provider, publicKey }),
    (error) => error.code === "RELOAD_VERIFICATION_FAILED");
});
