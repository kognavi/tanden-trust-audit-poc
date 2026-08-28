"use strict";

const { validateEvidenceAgainstSchema } = require("./schema-validation");
const { assertValidVersion } = require("./pg-evidence-store");

const EVIDENCE_STORED_EVENT_TYPE = "evidence.stored";

class EvidenceValidationError extends Error {
  constructor(errors) {
    super("Evidence failed schema validation.");
    this.name = "EvidenceValidationError";
    this.code = "EVIDENCE_SCHEMA_VALIDATION_FAILED";
    this.validationErrors = errors;
  }
}

class EvidenceStoreWriteError extends Error {
  constructor({ signResult, cause }) {
    super("Evidence was signed, but could not be stored.", { cause });
    this.name = "EvidenceStoreWriteError";
    this.code = cause?.code ?? "EVIDENCE_STORE_WRITE_FAILED";
    this.signResult = sanitizeSignResult(signResult);
  }
}

class EvidenceLedgerWriteError extends Error {
  constructor({ signResult, storeResult, cause }) {
    super(
      "Evidence was signed and stored, but the ledger event could not be appended. " +
        "The immutable stored evidence must not be rolled back; use `reconciliationData` to retry the ledger write.",
      { cause }
    );
    this.name = "EvidenceLedgerWriteError";
    this.code = "EVIDENCE_STORED_LEDGER_WRITE_FAILED";
    this.signResult = sanitizeSignResult(signResult);
    this.storeResult = storeResult;
    this.reconciliationData = createLedgerRequest(this.signResult, storeResult);
  }
}

class EvidenceProcessingService {
  constructor({ schema, signingProvider, evidenceStore, pgLogger } = {}) {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      throw new Error("EvidenceProcessingService requires a JSON `schema` object.");
    }
    if (!signingProvider || typeof signingProvider.signEvidence !== "function") {
      throw new Error("EvidenceProcessingService requires a `signingProvider` implementing signEvidence().");
    }
    if (!evidenceStore || typeof evidenceStore.appendEvidence !== "function") {
      throw new Error("EvidenceProcessingService requires an `evidenceStore` implementing appendEvidence().");
    }
    if (!pgLogger || typeof pgLogger.appendEvent !== "function") {
      throw new Error("EvidenceProcessingService requires a `pgLogger` implementing appendEvent().");
    }

    this._schema = schema;
    this._signingProvider = signingProvider;
    this._evidenceStore = evidenceStore;
    this._pgLogger = pgLogger;
  }

  async processEvidence(evidence, { version, privateKeyPem } = {}) {
    const validation = validateEvidenceAgainstSchema(evidence, this._schema);
    if (!validation.isValid) {
      throw new EvidenceValidationError(validation.errors);
    }
    assertValidVersion(version);

    const signResult = privateKeyPem
      ? await this._signingProvider.signEvidence(evidence, privateKeyPem)
      : await this._signingProvider.signEvidence(evidence);

    let storeResult;
    try {
      storeResult = await this._evidenceStore.appendEvidence({
        evidenceId: evidence.evidenceId,
        version,
        evidence,
        canonicalization: signResult.canonicalization,
        hashAlgorithm: signResult.hashAlgorithm,
        digestHex: signResult.digestHex,
        signature: signResult.signatureBase64,
        signingAlgorithm: signResult.signatureAlgorithm,
        kmsKeyId: signResult.kmsKeyId ?? null,
      });
    } catch (cause) {
      throw new EvidenceStoreWriteError({ signResult, cause });
    }

    const ledgerRequest = createLedgerRequest(signResult, storeResult);
    let ledgerRow;
    try {
      ledgerRow = await this._pgLogger.appendEvent(ledgerRequest);
    } catch (cause) {
      throw new EvidenceLedgerWriteError({ signResult, storeResult, cause });
    }

    return {
      evidenceId: storeResult.evidenceId,
      version: storeResult.version,
      digest: signResult.digestHex,
      signatureMetadata: {
        canonicalization: signResult.canonicalization,
        hashAlgorithm: signResult.hashAlgorithm,
        signatureAlgorithm: signResult.signatureAlgorithm,
        kmsKeyId: signResult.kmsKeyId ?? null,
        signedAt: signResult.signedAt ?? null,
      },
      storeReference: storeResult,
      ledgerEventId: ledgerRow.eventId,
    };
  }
}

function sanitizeSignResult(signResult) {
  return {
    canonicalization: signResult.canonicalization,
    hashAlgorithm: signResult.hashAlgorithm,
    digestHex: signResult.digestHex,
    signatureBase64: signResult.signatureBase64,
    signatureAlgorithm: signResult.signatureAlgorithm,
    kmsKeyId: signResult.kmsKeyId ?? null,
    signedAt: signResult.signedAt ?? null,
  };
}

function createLedgerRequest(signResult, storeResult) {
  return {
    eventType: EVIDENCE_STORED_EVENT_TYPE,
    payload: createLedgerPayload(signResult, storeResult),
    signature: signResult.signatureBase64,
  };
}

function createLedgerPayload(signResult, storeResult) {
  return {
    evidenceId: storeResult.evidenceId,
    version: storeResult.version,
    digestHex: signResult.digestHex,
    canonicalization: signResult.canonicalization,
    hashAlgorithm: signResult.hashAlgorithm,
    signatureAlgorithm: signResult.signatureAlgorithm,
    kmsKeyId: signResult.kmsKeyId ?? null,
    storeReference: {
      id: storeResult.id,
      evidenceId: storeResult.evidenceId,
      version: storeResult.version,
      digestHex: storeResult.digestHex,
      createdAt: storeResult.createdAt,
    },
  };
}

module.exports = {
  EvidenceProcessingService,
  EvidenceValidationError,
  EvidenceStoreWriteError,
  EvidenceLedgerWriteError,
};
