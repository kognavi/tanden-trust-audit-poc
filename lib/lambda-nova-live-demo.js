"use strict";

const { LambdaNovaCollector } = require("./collectors/lambda-nova-collector");
const { mapNormalizedAgentEventToEvidence } = require("./ai-agent-evidence-mapper");
const { LocalEcdsaProvider } = require("./local-ecdsa-provider");
const { EvidenceProcessingService } = require("./evidence-processing-service");
const evidenceSchema = require("../schemas/ai-agent-evidence.schema.json");

class LambdaNovaLiveDemoError extends Error {
  constructor(code) {
    super(code);
    this.name = "LambdaNovaLiveDemoError";
    this.code = code;
  }
}

class LambdaNovaDemoEvidenceStore {
  constructor(stageTrace = []) {
    this._records = new Map();
    this._stageTrace = stageTrace;
  }

  async appendEvidence(input) {
    const key = `${input.evidenceId}:${input.version}`;
    if (this._records.has(key)) throw new LambdaNovaLiveDemoError("EVIDENCE_VERSION_EXISTS");
    const createdAt = new Date(input.evidence.occurredAt);
    const record = structuredClone({ id: 1701, ...input, createdAt });
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

async function verifyReloadedRecord({ record, processResult, provider, publicKey }) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new LambdaNovaLiveDemoError("RELOAD_MISSING");
  }
  if (record.evidenceId !== processResult.evidenceId ||
      record.version !== processResult.version || record.digestHex !== processResult.digest) {
    throw new LambdaNovaLiveDemoError("RELOAD_IDENTITY_MISMATCH");
  }
  if (!record.evidence || typeof record.evidence !== "object" || Array.isArray(record.evidence) ||
      typeof record.signature !== "string" || record.signature.length === 0) {
    throw new LambdaNovaLiveDemoError("RELOAD_INVALID");
  }
  let verified;
  try {
    verified = await provider.verifyEvidenceSignature(
      record.evidence,
      Buffer.from(record.signature, "base64"),
      publicKey
    );
  } catch {
    throw new LambdaNovaLiveDemoError("RELOAD_VERIFICATION_FAILED");
  }
  if (!verified.valid || verified.digestHex !== processResult.digest) {
    throw new LambdaNovaLiveDemoError("RELOAD_VERIFICATION_FAILED");
  }
  return verified;
}

async function runLambdaNovaLiveDemo({ lambdaResponse, expectedRunId } = {}) {
  const collector = new LambdaNovaCollector({ lambdaResponse, expectedRunId });
  const event = await collector.collect();
  const evidence = mapNormalizedAgentEventToEvidence(event);
  const receipt = collector.receipt();

  const provider = new LocalEcdsaProvider();
  const { privateKey, publicKey } = provider.generateEcKeyPair();
  const processingStages = [];
  const evidenceStore = new LambdaNovaDemoEvidenceStore(processingStages);
  const pgLogger = {
    async appendEvent() {
      processingStages.push("ledger");
      return { eventId: `ledger-loop017b-${evidence.evidenceId}` };
    },
  };
  const service = new EvidenceProcessingService({
    schema: evidenceSchema,
    signingProvider: provider,
    evidenceStore,
    pgLogger,
  });
  const result = await service.processEvidence(evidence, { version: 1, privateKeyPem: privateKey });
  const reloaded = await evidenceStore.getEvidenceVersion(result.evidenceId, result.version);
  await verifyReloadedRecord({ record: reloaded, processResult: result, provider, publicKey });
  processingStages.push("verify-reloaded");

  const tampered = structuredClone(reloaded.evidence);
  tampered.action.target += "#tampered";
  const tamperedVerification = await provider.verifyEvidenceSignature(
    tampered,
    Buffer.from(reloaded.signature, "base64"),
    publicKey
  );
  processingStages.push("verify-tampered");
  if (tamperedVerification.valid) throw new LambdaNovaLiveDemoError("TAMPER_VERIFICATION_FAILED");

  return {
    demoVersion: "1.0.0",
    source: "aws-lambda-bedrock-nova-loop017b",
    ...receipt,
    evidenceId: result.evidenceId,
    eventType: evidence.eventType,
    toolName: evidence.action.toolName,
    operation: evidence.action.operation,
    sideEffectCategory: evidence.sideEffect.category,
    digestSha256: result.digest,
    ledgerEventId: result.ledgerEventId,
    processingStages,
    verification: { reloaded: "PASS", tampered: "FAIL" },
    dataMinimization: {
      containsPersonalData: false,
      containsSecrets: false,
      rawPromptPersisted: false,
      rawModelOutputPersisted: false,
      rawToolArgumentsPersisted: false,
    },
    storeType: "local-demo-memory",
    ledgerType: "local-demo-double",
    awsWritesPerformedByProcessor: false,
  };
}

module.exports = {
  LambdaNovaDemoEvidenceStore,
  LambdaNovaLiveDemoError,
  verifyReloadedRecord,
  runLambdaNovaLiveDemo,
};
