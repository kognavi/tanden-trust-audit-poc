"use strict";

const crypto = require("node:crypto");

const { BedrockAgentCoreCollector } = require("./collectors/bedrock-agentcore-collector");
const { mapNormalizedAgentEventToEvidence } = require("./ai-agent-evidence-mapper");
const { LocalEcdsaProvider } = require("./local-ecdsa-provider");
const { EvidenceProcessingService } = require("./evidence-processing-service");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");

class AgentCoreLiveDemoError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "AgentCoreLiveDemoError";
    this.code = code;
  }
}

class AgentCoreDemoEvidenceStore {
  constructor({ stageTrace = [] } = {}) {
    this._records = new Map();
    this._stageTrace = stageTrace;
  }

  async appendEvidence(input) {
    const key = `${input.evidenceId}:${input.version}`;
    if (this._records.has(key)) {
      throw new AgentCoreLiveDemoError(
        "LIVE_DEMO_EVIDENCE_VERSION_EXISTS",
        "The local demo Store refuses duplicate Evidence identity and version."
      );
    }

    const createdAt = new Date("2026-09-05T03:31:00Z");
    const record = structuredClone({ id: 9001, ...input, createdAt });
    this._records.set(key, record);
    this._stageTrace.push("store");

    return {
      id: record.id,
      evidenceId: record.evidenceId,
      version: record.version,
      digestHex: record.digestHex,
      kmsKeyId: record.kmsKeyId,
      createdAt,
    };
  }

  async getEvidenceVersion(evidenceId, version) {
    this._stageTrace.push("reload");
    const record = this._records.get(`${evidenceId}:${version}`);
    return record ? structuredClone(record) : null;
  }
}

function assertReloadedRecordShape(record, processResult) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_RELOAD_MISSING",
      "The local demo Store did not return the processed Evidence version."
    );
  }

  if (
    record.evidenceId !== processResult.evidenceId ||
    record.version !== processResult.version ||
    record.digestHex !== processResult.digest
  ) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_RELOAD_IDENTITY_MISMATCH",
      "Reloaded Evidence identity, version, or digest does not match the processing result."
    );
  }

  if (
    record.evidence === null ||
    typeof record.evidence !== "object" ||
    Array.isArray(record.evidence) ||
    typeof record.signature !== "string" ||
    record.signature.length === 0
  ) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_RELOAD_INVALID",
      "Reloaded Evidence or signature is invalid."
    );
  }
}

async function verifyReloadedEvidenceRecord({ record, processResult, provider, publicKey }) {
  assertReloadedRecordShape(record, processResult);

  let verification;
  try {
    verification = await provider.verifyEvidenceSignature(
      record.evidence,
      Buffer.from(record.signature, "base64"),
      publicKey
    );
  } catch (cause) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_RELOAD_VERIFICATION_FAILED",
      "Reloaded Evidence could not be verified.",
      { cause }
    );
  }

  if (!verification.valid || verification.digestHex !== processResult.digest) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_RELOAD_VERIFICATION_FAILED",
      "Reloaded Evidence signature or recomputed digest is invalid."
    );
  }

  return verification;
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

  if (normalizedEvent.metadata.containsSecrets) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_SECRET_DATA_NOT_ALLOWED",
      "The portfolio live demo refuses events marked as containing secrets."
    );
  }

  const evidence = mapNormalizedAgentEventToEvidence(normalizedEvent);
  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();

  const processingStages = [];
  const evidenceStore = new AgentCoreDemoEvidenceStore({ stageTrace: processingStages });

  const pgLogger = {
    async appendEvent() {
      processingStages.push("ledger");
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

  const reloadedEvidence = await evidenceStore.getEvidenceVersion(
    processResult.evidenceId,
    processResult.version
  );
  const originalVerification = await verifyReloadedEvidenceRecord({
    record: reloadedEvidence,
    processResult,
    provider,
    publicKey,
  });
  processingStages.push("verify-reloaded");

  const signature = Buffer.from(reloadedEvidence.signature, "base64");
  const tampered = structuredClone(reloadedEvidence.evidence);
  tampered.action.target = `${tampered.action.target}#tampered`;
  const tamperedVerification = await provider.verifyEvidenceSignature(
    tampered,
    signature,
    publicKey
  );
  processingStages.push("verify-tampered");

  if (!originalVerification.valid || tamperedVerification.valid) {
    throw new AgentCoreLiveDemoError(
      "LIVE_DEMO_VERIFICATION_INVARIANT_FAILED",
      "Expected original evidence to verify and tampered evidence to fail verification."
    );
  }

  return {
    demoVersion: "1.1.0",
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
    processingStages,
    verification: { reloaded: "PASS", tampered: "FAIL" },
    dataMinimization: {
      containsPersonalData: evidence.metadata.containsPersonalData,
      containsSecrets: evidence.metadata.containsSecrets,
      rawRuntimeResponsePersisted: false,
    },
    awsWritesPerformedByProcessor: false,
  };
}

module.exports = {
  AgentCoreDemoEvidenceStore,
  AgentCoreLiveDemoError,
  runAgentCoreLiveDemo,
  verifyReloadedEvidenceRecord,
};
