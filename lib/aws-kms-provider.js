'use strict';

const { KMSClient, SignCommand, VerifyCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');

const {
  getEvidenceDigestDetails,
} = require('./signature-digest');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';
const KMS_SIGNING_ALGORITHM = 'ECDSA_SHA_256';
const EXPECTED_KEY_SPEC = 'ECC_SECG_P256K1';

// ★Critical#2: AWS KMS MessageType:'RAW' の非対称鍵Sign/Verifyにおける
// メッセージサイズ上限。証跡(evidence)は「事実の指紋」であるべきで、
// 大きな添付ファイルはS3等に外部保存しハッシュ参照する設計を前提とする。
const MAX_KMS_RAW_MESSAGE_BYTES = 4096;

/**
 * Decode a DER-encoded ECDSA signature into a 64-byte IEEE P1363 Raw_Signature.
 *
 * KMS Sign returns an ASN.1 DER sequence:
 *   SEQUENCE {
 *     INTEGER r,
 *     INTEGER s
 *   }
 *
 * Each INTEGER may have a leading 0x00 padding byte when the high bit is set.
 * This function strips padding and zero-pads each component to exactly 32 bytes.
 *
 * @param {Buffer} derSignature - DER-encoded ECDSA signature from KMS
 * @returns {Buffer} 64-byte raw signature (r || s, each 32 bytes)
 */
function decodeDerSignatureToRaw(derSignature) {
  let offset = 0;

  // SEQUENCE tag (0x30)
  // eslint-disable-next-line security/detect-object-injection -- Numeric buffer offset access during DER parsing, not a string-keyed object property (no prototype pollution vector).
  if (derSignature[offset] !== 0x30) {
    throw new Error('DER decode error: expected SEQUENCE tag 0x30');
  }
  offset += 1;

  // SEQUENCE length (skip — may be 1 or 2 bytes)
  // eslint-disable-next-line security/detect-object-injection -- Numeric buffer offset access.
  const seqLen = derSignature[offset];

  offset += seqLen > 0x80 ? 1 + (seqLen & 0x7f) : 1;

  /**
   * Read one DER INTEGER and return its value as a 32-byte Buffer.
   */
  function readInt() {
    // eslint-disable-next-line security/detect-object-injection -- Numeric buffer offset access.
    if (derSignature[offset] !== 0x02) {
      throw new Error('DER decode error: expected INTEGER tag 0x02');
    }
    offset += 1;
    // eslint-disable-next-line security/detect-object-injection -- Numeric buffer offset access.
    const len = derSignature[offset];

    offset += 1;
    let bytes = derSignature.slice(offset, offset + len);
    offset += len;

    // Strip leading zero-padding byte added when high bit is set
    if (bytes.length > 32 && bytes[0] === 0x00) {
      bytes = bytes.slice(bytes.length - 32);
    }

    // Zero-pad to 32 bytes if shorter
    if (bytes.length < 32) {
      const padded = Buffer.alloc(32, 0);
      bytes.copy(padded, 32 - bytes.length);
      return padded;
    }

    return Buffer.from(bytes);
  }

  const r = readInt();
  const s = readInt();

  return Buffer.concat([r, s]);
}

/**
 * Encode a 64-byte IEEE P1363 Raw_Signature (r || s) into an ASN.1 DER
 * ECDSA signature sequence, as required by KMS VerifyCommand.
 *
 * This is the inverse of decodeDerSignatureToRaw(). KMS Sign returns DER,
 * which we decode to Raw for storage (interface compatibility with
 * LocalEcdsaProvider). KMS Verify requires DER as input, so we must
 * re-encode before calling VerifyCommand.
 *
 * DER INTEGER encoding rules applied per component (r, s):
 *   - Strip leading 0x00 padding bytes (keep at least 1 byte).
 *   - If the resulting high bit is set (>= 0x80), prepend a single 0x00
 *     to keep the INTEGER unsigned/positive per DER convention.
 *
 * @param {Buffer} rawSignature - 64-byte raw signature (r || s, 32 bytes each)
 * @returns {Buffer} DER-encoded ECDSA signature
 */
function encodeRawToDer(rawSignature) {
  if (!Buffer.isBuffer(rawSignature) || rawSignature.length !== 64) {
    throw new Error(
      `encodeRawToDer: expected 64-byte raw signature, got ${rawSignature && rawSignature.length}`
    );
  }

  function encodeInteger(bytes32) {
    let start = 0;
    while (start < bytes32.length - 1 && bytes32[start] === 0x00) {
      start += 1;
    }
    let trimmed = bytes32.slice(start);

     
    if (trimmed[0] & 0x80) {
      trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
    }

    return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
  }

  const r = rawSignature.slice(0, 32);
  const s = rawSignature.slice(32, 64);
  const rEncoded = encodeInteger(r);
  const sEncoded = encodeInteger(s);
  const body = Buffer.concat([rEncoded, sEncoded]);

  if (body.length > 0x7f) {
    throw new Error(
      `encodeRawToDer: unexpected DER body length ${body.length} exceeds short-form limit`
    );
  }

  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

// ★Critical#2: KMS MessageType:'RAW' のメッセージサイズ上限ガード。
// この関数が無いと、上限超過時にKMSから返る分かりにくいAPIエラーで
// 落ちてしまう。Fail Fast (TD-001と同じ思想) で意味の分かるエラーを出す。
/**
 * Guard against exceeding KMS's RAW-message size limit for asymmetric
 * Sign/Verify. Evidence records are expected to be lightweight "fact
 * fingerprints"; large payloads (files, attachments) must be stored
 * externally (e.g. S3) and referenced by hash, not embedded directly.
 *
 * @param {Buffer} messageBuffer
 */
function assertWithinKmsRawLimit(messageBuffer) {
  if (messageBuffer.length > MAX_KMS_RAW_MESSAGE_BYTES) {
    throw new Error(
      `Evidence canonicalJson (${messageBuffer.length} bytes) exceeds KMS ` +
      `MessageType:'RAW' limit (${MAX_KMS_RAW_MESSAGE_BYTES} bytes). ` +
      `Store large payloads externally (S3) and reference them by hash ` +
      `inside the evidence record instead of embedding them directly.`
    );
  }
}

/**
 * AWS KMS ECC_SECG_P256K1 signature provider.
 *
 * Implements the same public interface as LocalEcdsaProvider so that
 * lib/signature.js can delegate to either provider transparently.
 *
 * Private key material never leaves AWS KMS / CloudHSM.
 * All sign and verify operations are recorded in CloudTrail automatically.
 *
 * Constructor parameters:
 * @param {object} [options]
 * @param {KMSClient} [options.kmsClient]  - Injected KMS client (for testing)
 *
 * Required environment variable:
 *   KMS_KEY_ID — ARN or alias of the KMS key to use for signing
 *
 * NOTE: 旧QLDBロガー統合コードは削除済み（2026-08-08）。
 * 台帳記録は AuditManager が PgSigningLogger.appendEvent() を
 * await する設計に統一されている（tasks.md タスク3.2参照、H4対応）。
 */
class AwsKmsProvider {
  constructor({ kmsClient } = {}) {
    const keyId = process.env.KMS_KEY_ID;
    if (!keyId) {
      throw new Error('KMS_KEY_ID environment variable is required');
    }

    this._keyId = keyId;
    this._kmsClient = kmsClient || new KMSClient({});
    this._verifiedKeySpec = null;
    this._cachedPublicKey = null;
  }

  // ── KeySpec verification (TD-001) / PublicKey cache (TD-003) ──────────────

  /**
   * Verify (once, then cache) that the KMS key's KeySpec matches the
   * curve this provider assumes (ECC_SECG_P256K1 / secp256k1).
   *
   * decodeDerSignatureToRaw() normalizes r/s to exactly 32 bytes each,
   * which is only correct for a 256-bit curve. If the KMS key were
   * configured with a different curve (e.g. P-384, P-521), signing
   * or verification would silently produce incorrect results instead
   * of failing loudly. This guard enforces Fail Fast (TD-001).
   *
   * As a side effect, this also caches the public key bytes (TD-003),
   * since GetPublicKeyCommand returns both KeySpec and PublicKey in a
   * single call.
   *
   * @returns {Promise<void>}
   */
  async _ensureKeySpecVerified() {
    if (this._verifiedKeySpec) return;

    let response;
    try {
      response = await this._kmsClient.send(new GetPublicKeyCommand({
        KeyId: this._keyId,
      }));
    } catch (err) {
      throw new Error(`KMS GetPublicKey operation failed during KeySpec verification: ${err.message}`, { cause: err });
    }

    if (response.KeySpec !== EXPECTED_KEY_SPEC) {
      throw new Error(
        `Unsupported KMS KeySpec: ${response.KeySpec}. ` +
        `AwsKmsProvider requires ${EXPECTED_KEY_SPEC} (secp256k1). ` +
        `Refusing to proceed to avoid silent signature corruption.`
      );
    }

    this._verifiedKeySpec = response.KeySpec;
    this._cachedPublicKey = Buffer.from(response.PublicKey);
  }

  // ── Low-level KMS operations ──────────────────────────────────────────────

  /**
   * Sign a message using KMS ECDSA_SHA_256.
   *
   * Public API wrapper around `_signDigestWithMeta`. Returns only the
   * raw signature Buffer for backward compatibility with callers that
   * do not need the resolved key ARN.
   *
   * @param {Buffer} message - Raw canonicalJson bytes (UTF-8), NOT a digest
   * @returns {Promise<Buffer>} 64-byte raw signature (r || s)
   */
  async signDigest(message) {
    const { rawSignature } = await this._signDigestWithMeta(message);
    return rawSignature;
  }

  /**
   * Internal: sign and return both the raw signature AND the resolved
   * physical key ARN from the KMS response.
   *
   * ★Critical#2 FIX: MessageType is 'RAW' (was 'DIGEST').
   * KMS RAW mode hashes `message` internally exactly once (SHA-256),
   * matching LocalEcdsaProvider's crypto.sign('sha256', message, ...)
   * semantics. See commit cd018d1 (Critical#2) for the full double-hash
   * mismatch explanation.
   *
   * AWS KMS always returns the physical key ARN in `response.KeyId`
   * even when the request used an alias. Using this resolved ARN
   * (instead of `this._keyId`) ensures the audit ledger records which
   * exact physical key produced each signature — critical for key
   * rotation traceability (H3: alias vs physical key ARN).
   *
   * `message` MUST be the raw pre-hash bytes (the UTF-8 canonical JSON
   * buffer) — NOT a pre-computed SHA-256 digest.
   *
   * @param {Buffer} message
   * @returns {Promise<{rawSignature: Buffer, resolvedKeyId: string}>}
   */
  async _signDigestWithMeta(message) {
    await this._ensureKeySpecVerified();
    assertWithinKmsRawLimit(message); // ★Critical#2: Fail Fast size guard

    let response;
    try {
      response = await this._kmsClient.send(new SignCommand({
        KeyId: this._keyId,
        Message: message,
        MessageType: 'RAW', // ★Critical#2 FIX: was 'DIGEST'
        SigningAlgorithm: KMS_SIGNING_ALGORITHM,
      }));
    } catch (err) {
      throw new Error(`KMS Sign operation failed: ${err.message}`, { cause: err });
    }

    const rawSignature = decodeDerSignatureToRaw(Buffer.from(response.Signature));
    // response.KeyId is always the physical key ARN, even when the request
    // was made with an alias. Fall back to this._keyId only if KMS omits it
    // (guards against SDK version gaps; should never happen in practice).
    const resolvedKeyId = response.KeyId ?? this._keyId;
    return { rawSignature, resolvedKeyId };
  }

  /**
   * Verify a raw signature against a message using KMS ECDSA_SHA_256.
   *
   * Public API wrapper around `_verifyDigestSignatureWithMeta`. Returns
   * only the boolean result for backward compatibility.
   *
   * @param {Buffer} message   - Raw canonicalJson bytes (UTF-8), NOT a digest
   * @param {Buffer} signature - 64-byte IEEE P1363 raw signature
   * @returns {Promise<boolean>}
   */
  async verifyDigestSignature(message, signature) {
    const { valid } = await this._verifyDigestSignatureWithMeta(message, signature);
    return valid;
  }

  /**
   * Internal: verify and return both the boolean result AND the resolved
   * physical key ARN from the KMS response (H3: key rotation audit trail).
   *
   * KMS VerifyCommand requires ASN.1 DER format. Since this provider
   * stores/passes signatures as 64-byte Raw (r || s) for interface
   * compatibility with LocalEcdsaProvider, Raw is re-encoded to DER
   * before calling KMS (Critical#1 fix). MessageType is 'RAW'
   * (Critical#2 fix — see _signDigestWithMeta for rationale).
   *
   * KMSInvalidSignatureException is a normal verification outcome per
   * KMS API spec — it means the signature is invalid, not a service
   * failure. Treating it as `false` is required so AuditManager can
   * record the tamper_detected event. On this path, resolvedKeyId falls
   * back to this._keyId since no KMS response is available (H3-f backlog).
   *
   * @param {Buffer} message
   * @param {Buffer} signature - 64-byte IEEE P1363 raw signature
   * @returns {Promise<{valid: boolean, resolvedKeyId: string}>}
   */
  async _verifyDigestSignatureWithMeta(message, signature) {
    await this._ensureKeySpecVerified();
    assertWithinKmsRawLimit(message); // ★Critical#2: Fail Fast size guard

    const derSignature = encodeRawToDer(signature);

    let response;
    try {
      response = await this._kmsClient.send(new VerifyCommand({
        KeyId: this._keyId,
        Message: message,
        MessageType: 'RAW', // ★Critical#2 FIX: was 'DIGEST'
        Signature: derSignature,
        SigningAlgorithm: KMS_SIGNING_ALGORITHM,
      }));
    } catch (err) {
      if (err.name === 'KMSInvalidSignatureException') {
        // ref: docs.aws.amazon.com/kms/latest/APIReference/API_Verify.html
        return { valid: false, resolvedKeyId: this._keyId };
      }
      throw new Error(`KMS Verify operation failed: ${err.message}`, { cause: err });
    }

    const resolvedKeyId = response.KeyId ?? this._keyId;
    return { valid: response.SignatureValid === true, resolvedKeyId };
  }

  /**
   * Retrieve the public key as SPKI DER bytes from KMS.
   *
   * The first call triggers KeySpec verification (TD-001) and caches
   * the result (TD-003); subsequent calls return the cached value
   * without issuing a new KMS API request.
   *
   * @returns {Promise<Buffer>}
   */
  async getPublicKey() {
    await this._ensureKeySpecVerified();
    return this._cachedPublicKey;
  }

  // ── High-level evidence operations ───────────────────────────────────────

  /**
   * Sign an evidence record.
   *
   * Pipeline: RFC 8785 JCS canonicalization → KMS Sign (RAW mode, KMS
   * hashes internally once)
   *
   * ★Critical#2 FIX: passes digestDetails.canonicalJson bytes to
   * signDigest() (was digestDetails.digest). See signDigest() doc
   * comment for rationale. Public contract (signEvidence's own
   * parameters and return shape) is UNCHANGED.
   *
   * Returns an object compatible with LocalEcdsaProvider.signEvidence()
   * plus KMS-specific fields (kmsKeyId, signingAlgorithm, signedAt).
   *
   * @param {object} evidence - Parsed evidence JSON object
   * @returns {Promise<object>}
   */
  async signEvidence(evidence) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const message = Buffer.from(digestDetails.canonicalJson, 'utf8'); // ★Critical#2 FIX: was digestDetails.digest
    const { rawSignature: signature, resolvedKeyId } = await this._signDigestWithMeta(message);
    const signedAt = new Date().toISOString();

    // canonicalJson は署名計算の一時変数としてのみ使用する。
    // 戻り値に含めると呼び出し元での誤った永続化を招くため除外する（H5 データ最小化）。
    return {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      digestHex: digestDetails.digestHex,
      signature,
      signatureBase64: signature.toString('base64'),
      kmsKeyId: resolvedKeyId,
      signingAlgorithm: KMS_SIGNING_ALGORITHM,
      signedAt,
    };
  }

  /**
   * Verify the signature of an evidence record.
   *
   * Pipeline: RFC 8785 JCS canonicalization → KMS Verify (RAW mode)
   *
   * ★Critical#2 FIX: passes digestDetails.canonicalJson bytes to
   * verifyDigestSignature() (was digestDetails.digest). Public contract
   * (verifyEvidenceSignature's own parameters and return shape) is
   * UNCHANGED.
   *
   * Returns an object compatible with LocalEcdsaProvider.verifyEvidenceSignature().
   *
   * @param {object} evidence  - Parsed evidence JSON object
   * @param {Buffer} signature - 64-byte IEEE P1363 raw signature
   * @returns {Promise<object>}
   */
  async verifyEvidenceSignature(evidence, signature) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const message = Buffer.from(digestDetails.canonicalJson, 'utf8'); // ★Critical#2 FIX: was digestDetails.digest
    const { valid, resolvedKeyId } = await this._verifyDigestSignatureWithMeta(message, signature);

    return {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      digestHex: digestDetails.digestHex,
      valid,
      kmsKeyId: resolvedKeyId,
    };
  }
}

module.exports = {
  SIGNATURE_ALGORITHM,
  KMS_SIGNING_ALGORITHM,
  decodeDerSignatureToRaw,
  encodeRawToDer,
  AwsKmsProvider,
};
