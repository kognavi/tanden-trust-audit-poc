"use strict";

const { assertNormalizedAgentEvent } = require("./normalized-agent-event");

const AI_AGENT_EVIDENCE_SCHEMA_VERSION = "1.0.0";
const HASH_ALGORITHM = "SHA-256";

function mapNormalizedAgentEventToEvidence(event) {
  assertNormalizedAgentEvent(event);

  return {
    schemaVersion: AI_AGENT_EVIDENCE_SCHEMA_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    evidenceId: event.evidenceId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    sourceSystem: event.sourceSystem,
    actor: structuredClone(event.actor),
    agent: structuredClone(event.agent),
    model: structuredClone(event.model),
    execution: structuredClone(event.execution),
    policy: structuredClone(event.policy),
    action: structuredClone(event.action),
    approval: structuredClone(event.approval),
    sideEffect: structuredClone(event.sideEffect),
    contextReferences: structuredClone(event.contextReferences),
    artifacts: structuredClone(event.artifacts),
    metadata: structuredClone(event.metadata),
  };
}

module.exports = {
  AI_AGENT_EVIDENCE_SCHEMA_VERSION,
  HASH_ALGORITHM,
  mapNormalizedAgentEventToEvidence,
};
