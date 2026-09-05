"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fixture = require("../fixtures/agent-tool-call.normalized.json");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");
const {
  mapNormalizedAgentEventToEvidence,
  AI_AGENT_EVIDENCE_SCHEMA_VERSION,
  HASH_ALGORITHM,
} = require("../lib/ai-agent-evidence-mapper");
const { validateEvidenceAgainstSchema } = require("../lib/schema-validation");

test("mapper produces AI Agent Evidence that satisfies the canonical schema", () => {
  const evidence = mapNormalizedAgentEventToEvidence(fixture);
  const validation = validateEvidenceAgainstSchema(evidence, evidenceSchema);

  assert.equal(validation.isValid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(evidence.schemaVersion, AI_AGENT_EVIDENCE_SCHEMA_VERSION);
  assert.equal(evidence.hashAlgorithm, HASH_ALGORITHM);
  assert.equal(evidence.action.toolName, fixture.action.toolName);
  assert.equal(evidence.rawPrompt, undefined);
  assert.equal(JSON.stringify(evidence).includes("sensitive prompt text"), false);
});

test("mapper deep-clones runtime data", () => {
  const event = structuredClone(fixture);
  const evidence = mapNormalizedAgentEventToEvidence(event);

  evidence.policy.policyId = "mutated";
  evidence.contextReferences[0].reference = "mutated";

  assert.equal(event.policy.policyId, fixture.policy.policyId);
  assert.equal(event.contextReferences[0].reference, fixture.contextReferences[0].reference);
});

test("mapper rejects an event without approval context", () => {
  const event = structuredClone(fixture);
  delete event.approval;

  assert.throws(
    () => mapNormalizedAgentEventToEvidence(event),
    /Normalized Agent event failed contract validation/
  );
});
