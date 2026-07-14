'use strict';

/**
 * Thrown when signing (or verification) succeeded but the audit ledger
 * write failed.
 *
 * Carries the already-produced result (`signResult`) so callers can
 * retry the ledger write WITHOUT re-invoking KMS — this avoids
 * duplicate signatures for the same evidence and avoids unnecessary
 * KMS API cost/latency on retry.
 */
class AuditLedgerWriteError extends Error {
  constructor(message, { signResult, cause } = {}) {
    super(message);
    this.name = 'AuditLedgerWriteError';
    this.signResult = signResult;
    this.cause = cause;
  }
}

/**
 * AuditManager glues a signing provider (AwsKmsProvider or
 * LocalEcdsaProvider) to the tamper-evident PgSigningLogger ledger.
 *
 * Design decisions (ADR discussion 2026-07-13):
 *  - Ledger payload stores only evidenceId + digest + algorithm metadata,
 *    NEVER the raw evidence body (data minimization / security).
 *  - If the ledger write fails after a successful signature, the error
 *    carries `signResult` so the caller can retry recording without
 *    re-signing (reliability).
 *  - verifyAndRecord() does NOT write to the ledger on successful
 *    verification by default (verification is idempotent and read-only —
 *    cost optimization). Failed verifications (tamper detected) are
 *    ALWAYS recorded, since they represent a new security-relevant fact.
 */
class AuditManager {
  constructor({ signingProvider, pgLogger } = {}) {
    if (!signingProvider) {
      throw new Error('AuditManager requires a `signingProvider`.');
    }
    if (!pgLogger) {
      throw new Error('AuditManager requires a `pgLogger`.');
    }
    this._provider = signingProvider;
    this._pgLogger = pgLogger;
  }

  /**
   * Sign evidence and record the event in the tamper-evident ledger.
   *
   * @param {object} evidence
   * @param {object} [options]
   * @param {string} [options.privateKeyPem] - required only for LocalEcdsaProvider
   * @returns {Promise<{signResult: object, ledgerRow: object}>}
   * @throws {AuditLedgerWriteError} if signing succeeded but the ledger write failed
   */
  async signAndRecord(evidence, { privateKeyPem } = {}) {
    const signResult = privateKeyPem
      ? await this._provider.signEvidence(evidence, privateKeyPem)
      : await this._provider.signEvidence(evidence);

    let ledgerRow;
    try {
      ledgerRow = await this._pgLogger.appendEvent({
        eventType: 'evidence.signed',
        payload: {
          evidenceId: evidence.evidenceId ?? null,
          digestHex: signResult.digestHex,
          canonicalization: signResult.canonicalization,
          hashAlgorithm: signResult.hashAlgorithm,
          signatureAlgorithm: signResult.signatureAlgorithm,
          kmsKeyId: signResult.kmsKeyId ?? null,
        },
        signature: signResult.signatureBase64,
      });
    } catch (err) {
      throw new AuditLedgerWriteError(
        'Signature was produced successfully, but appending it to the audit ledger failed. ' +
        'The signature in `err.signResult` is valid and can be recorded via a retry ' +
        'WITHOUT re-signing.',
        { signResult, cause: err }
      );
    }

    return { signResult, ledgerRow };
  }

  /**
   * Verify an evidence signature. Records to the ledger ONLY when
   * verification fails (tamper detected) or when explicitly forced.
   *
   * @param {object} evidence
   * @param {Buffer} signature
   * @param {object} [options]
   * @param {string}  [options.publicKeyPem]   - required only for LocalEcdsaProvider
   * @param {boolean} [options.recordSuccess]  - force-record even on success (default: false)
   * @returns {Promise<{verifyResult: object, ledgerRow: object|null}>}
   * @throws {AuditLedgerWriteError} if verification succeeded but the ledger write failed
   */
  async verifyAndRecord(evidence, signature, { publicKeyPem, recordSuccess = false } = {}) {
    const verifyResult = publicKeyPem
      ? await this._provider.verifyEvidenceSignature(evidence, signature, publicKeyPem)
      : await this._provider.verifyEvidenceSignature(evidence, signature);

    const shouldRecord = !verifyResult.valid || recordSuccess;
    if (!shouldRecord) {
      return { verifyResult, ledgerRow: null };
    }

    let ledgerRow;
    try {
      ledgerRow = await this._pgLogger.appendEvent({
        eventType: verifyResult.valid ? 'evidence.verified' : 'evidence.tamper_detected',
        payload: {
          evidenceId: evidence.evidenceId ?? null,
          digestHex: verifyResult.digestHex,
          valid: verifyResult.valid,
        },
        signature: Buffer.isBuffer(signature) ? signature.toString('base64') : String(signature),
      });
    } catch (err) {
      throw new AuditLedgerWriteError(
        'Verification completed, but appending the result to the audit ledger failed.',
        { signResult: verifyResult, cause: err }
      );
    }

    return { verifyResult, ledgerRow };
  }
}

module.exports = { AuditManager, AuditLedgerWriteError };