"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fixture = require("../fixtures/agent-tool-call.normalized.json");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");
const { FixtureAgentCollector } = require("../lib/collectors/fixture-agent-collector");
const { mapNormalizedAgentEventToEvidence } = require("../lib/ai-agent-evidence-mapper");
const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { EvidenceProcessingService } = require("../lib/evidence-processing-service");

test("fixture Agent event flows through EvidenceProcessingService and tampering is detected", async () => {
  const collector = new FixtureAgentCollector({ fixture });
  const normalizedEvent = await collector.collect();
  const evidence = mapNormalizedAgentEventToEvidence(normalizedEvent);

  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();

  let stored;
  const evidenceStore = {
    async appendEvidence(input) {
      stored = structuredClone(input);
      return {
        id: 501,
        evidenceId: input.evidenceId,
        version: input.version,
        digestHex: input.digestHex,
        kmsKeyId: input.kmsKeyId,
        createdAt: new Date("2026-09-05T01:16:00Z"),
      };
    },
  };

  const ledgerEvents = [];
  const pgLogger = {
    async appendEvent(event) {
      ledgerEvents.push(structuredClone(event));
      return { eventId: "ledger-fixture-0001" };
    },
  };

  const service = new EvidenceProcessingService({
    schema: evidenceSchema,
    signingProvider: provider,
    evidenceStore,
    pgLogger,
  });

  const result = await service.processEvidence(evidence, {
    version: 1,
    privateKeyPem: privateKey,
  });

  assert.equal(result.evidenceId, fixture.evidenceId);
  assert.equal(result.ledgerEventId, "ledger-fixture-0001");
  assert.equal(stored.evidence.action.toolName, fixture.action.toolName);
  assert.equal(ledgerEvents.length, 1);
  assert.equal(ledgerEvents[0].payload.evidenceId, fixture.evidenceId);

  const signature = Buffer.from(stored.signature, "base64");
  const originalVerification = await provider.verifyEvidenceSignature(
    stored.evidence,
    signature,
    publicKey
  );
  assert.equal(originalVerification.valid, true);

  const tampered = structuredClone(stored.evidence);
  tampered.action.target = "synthetic://crm/customer/attacker";

  const tamperedVerification = await provider.verifyEvidenceSignature(
    tampered,
    signature,
    publicKey
  );
  assert.equal(tamperedVerification.valid, false);
});
