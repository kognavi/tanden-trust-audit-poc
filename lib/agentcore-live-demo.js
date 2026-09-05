"use strict";

const crypto = require("node:crypto");

const { BedrockAgentCoreCollector } = require("./collectors/bedrock-agentcore-collector");
const { mapNormalizedAgentEventToEvidence } = require("./ai-agent-evidence-mapper");
const { LocalEcdsaProvider } = require("./local-ecdsa-provider");
const { EvidenceProcessingService } = require("./evidence-processing-service");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");

class AgentCoreLiveDemoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AgentCoreLiveDemoError";
    this.code = code;
  }
}

async function runAgentCoreLiveDemo({
  runtimeResponse,
  runtimeArn,
  runtimeSessionId,
  traceId,
  qualifier = "DEFAULT",
  region = "ap-northeast-1",
} = {}) {
  if (typeof runtimeArn !== "string" || runtimeArn.length === 0) {
    throw new AgentCoreLiveDemoError("AGENTCORE_RUNTIME_ARN_REQUIRED", "runtimeArn is required.");
  }
  if (typeof runtimeSessionId !== "string" || runtimeSessionId.length < 33) {
    throw new AgentCoreLiveDemoError(
      "AGENTCORE_RUNTIME_SESSION_REQUIRED",
      "runtimeSessionId must be at least 33 characters for AgentCore Runtime."
    );
  }
  if (typeof traceId !== "string" || traceId.length === 0) {
    throw new AgentCoreLiveDemoError("AGENTCORE_TRACE_ID_REQUIRED", "traceId is required.");
  }

  const collector = new BedrockAgentCoreCollector({
    runtimeResponse,
    expectedRuntimeSessionId: runtimeSessionId,
    expectedTraceId: traceId,
  });
  const normalizedEvent = await collector.collect();

  if (normalizedEvent.metadata.containsPersonalData) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_PERSONAL_DATA_NOT_ALLOWED",
      "The portfolio live demo refuses events marked as containing personal data."
    );
  }

  const evidence = mapNormalizedAgentEventToEvidence(normalizedEvent);
  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();

  let storedEvidence;
  const evidenceStore = {
    async appendEvidence(input) {
      storedEvidence = structuredClone(input);
      return {
        id: 9001,
        evidenceId: input.evidenceId,
        version: input.version,
        digestHex: input.digestHex,
        kmsKeyId: input.kmsKeyId,
        createdAt: new Date("2026-09-05T03:31:00Z"),
      };
    },
  };

  const pgLogger = {
    async appendEvent() {
      return { eventId: "ledger-agentcore-demo-0001" };
    },
  };

  const service = new EvidenceProcessingService({
    schema: evidenceSchema,
    signingProvider: provider,
    evidenceStore,
    pgLogger,
  });

  const processResult = await service.processEvidence(evidence, {
    version: 1,
    privateKeyPem: privateKey,
  });

  const signature = Buffer.from(storedEvidence.signature, "base64");
  const originalVerification = await provider.verifyEvidenceSignature(
    storedEvidence.evidence,
    signature,
    publicKey
  );

  const tampered = structuredClone(storedEvidence.evidence);
  tampered.action.target = `${tampered.action.target}#tampered`;
  const tamperedVerification = await provider.verifyEvidenceSignature(
    tampered,
    signature,
    publicKey
  );

  if (!originalVerification.valid || tamperedVerification.valid) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_VERIFICATION_INVARIANT_FAILED",
      "Expected original evidence to verify and tampered evidence to fail verification."
    );
  }

  return {
    demoVersion: "1.0.0",
    source: "amazon-bedrock-agentcore",
    region,
    qualifier,
    runtimeArnSha256: crypto.createHash("sha256").update(runtimeArn, "utf8").digest("hex"),
    runtimeSessionId,
    traceId,
    evidenceId: processResult.evidenceId,
    eventType: evidence.eventType,
    toolName: evidence.action.toolName,
    operation: evidence.action.operation,
    policyDecision: evidence.policy.decision,
    approvalStatus: evidence.approval.status,
    sideEffectCategory: evidence.sideEffect.category,
    digestSha256: processResult.digest,
    ledgerEventId: processResult.ledgerEventId,
    verification: { original: "PASS", tampered: "FAIL" },
    dataMinimization: {
      containsPersonalData: evidence.metadata.containsPersonalData,
      containsSecrets: evidence.metadata.containsSecrets,
      rawRuntimeResponsePersisted: false,
    },
    awsWritesPerformedByProcessor: false,
  };
}

module.exports = { AgentCoreLiveDemoError, runAgentCoreLiveDemo };
