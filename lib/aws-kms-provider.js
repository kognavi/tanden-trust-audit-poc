'use strict';

const { KMSClient, SignCommand, VerifyCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');

const {
  getEvidenceDigestDetails,
} = require('./signature-digest');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';
const KMS_SIGNING_ALGORITHM = 'ECDSA_SHA_256';
const EXPECTED_KEY_SPEC = 'ECC_SECG_P256K1';

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
  if (derSignature[offset] !== 0x30) {
    throw new Error('DER decode error: expected SEQUENCE tag 0x30');
  }
  offset += 1;

  // SEQUENCE length (skip — may be 1 or 2 bytes)
  const seqLen = derSignature[offset];
  offset += seqLen > 0x80 ? 1 + (seqLen & 0x7f) : 1;

  /**
   * Read one DER INTEGER and return its value as a 32-byte Buffer.
   */
  function readInt() {
    if (derSignature[offset] !== 0x02) {
      throw new Error('DER decode error: expected INTEGER tag 0x02');
    }
    offset += 1;
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
 * @param {object}    [options.logger]     - Injected QLDB/PG logger (for testing)
 *
 * Required environment variable:
 *   KMS_KEY_ID — ARN or alias of the KMS key to use for signing
 */
class AwsKmsProvider {
  constructor({ kmsClient, logger } = {}) {
    const keyId = process.env.KMS_KEY_ID;
    if (!keyId) {
      throw new Error('KMS_KEY_ID environment variable is required');
    }

    this._keyId = keyId;
    this._kmsClient = kmsClient || new KMSClient({});
    this._logger = logger || null;
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
   * Sign a raw digest Buffer using KMS ECDSA_SHA_256.
   *
   * KMS expects Message to be the pre-hashed digest when
   * MessageType is 'DIGEST'. Returns a 64-byte IEEE P1363 Raw_Signature.
   *
   * @param {Buffer} digest - SHA-256 digest of the evidence
   * @returns {Promise<Buffer>} 64-byte raw signature (r || s)
   */
  async signDigest(digest) {
    await this._ensureKeySpecVerified();

    let response;
    try {
      response = await this._kmsClient.send(new SignCommand({
        KeyId: this._keyId,
        Message: digest,
        MessageType: 'DIGEST',
        SigningAlgorithm: KMS_SIGNING_ALGORITHM,
      }));
    } catch (err) {
      throw new Error(`KMS Sign operation failed: ${err.message}`, { cause: err });
    }

    const derSignature = Buffer.from(response.Signature);
    return decodeDerSignatureToRaw(derSignature);
  }

  /**
   * Verify a raw signature against a digest using KMS ECDSA_SHA_256.
   *
   * @param {Buffer} digest    - SHA-256 digest of the evidence
   * @param {Buffer} signature - 64-byte IEEE P1363 raw signature
   * @returns {Promise<boolean>}
   */
  async verifyDigestSignature(digest, signature) {
  await this._ensureKeySpecVerified();

  try {
    const response = await this._kmsClient.send(new VerifyCommand({
      KeyId: this._keyId,
      Message: digest,
      MessageType: 'DIGEST',
      Signature: signature,
      SigningAlgorithm: KMS_SIGNING_ALGORITHM,
    }));
    return response.SignatureValid === true;
  } catch (err) {
    // KMSInvalidSignatureException は「署名検証に失敗した」という
    // “正常な検証結果”であり、KMS Verify API 仕様上の挙動。
    // これを false として扱わないと、改ざん検知イベントが
    // AuditManager に到達せず監査ログに記録されない重大な欠陥になる。
    // ref: docs.aws.amazon.com/kms/latest/APIReference/API_Verify.html
    if (err.name === 'KMSInvalidSignatureException') {
      return false;
    }
    throw new Error(`KMS Verify operation failed: ${err.message}`, { cause: err });
  }
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
   * Pipeline: RFC 8785 JCS canonicalization → SHA-256 digest → KMS Sign
   *
   * Returns an object compatible with LocalEcdsaProvider.signEvidence()
   * plus KMS-specific fields (kmsKeyId, signingAlgorithm, signedAt).
   *
   * @param {object} evidence - Parsed evidence JSON object
   * @returns {Promise<object>}
   */
  async signEvidence(evidence) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const signature = await this.signDigest(digestDetails.digest);
    const signedAt = new Date().toISOString();

    const result = {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      canonicalJson: digestDetails.canonicalJson,
      digestHex: digestDetails.digestHex,
      signature,
      signatureBase64: signature.toString('base64'),
      kmsKeyId: this._keyId,
      signingAlgorithm: KMS_SIGNING_ALGORITHM,
      signedAt,
    };

    // Fire-and-forget QLDB/PG audit log — never block the signing result
    if (this._logger) {
      this._logger.logSigningEvent({
        eventType: 'SIGN',
        evidenceId: evidence.evidenceId || '',
        digestHex: digestDetails.digestHex,
        kmsKeyId: this._keyId,
        signingAlgorithm: KMS_SIGNING_ALGORITHM,
        signedAt,
        status: 'SUCCESS',
      }).catch(console.error);
    }

    return result;
  }

  /**
   * Verify the signature of an evidence record.
   *
   * Pipeline: RFC 8785 JCS canonicalization → SHA-256 digest → KMS Verify
   *
   * Returns an object compatible with LocalEcdsaProvider.verifyEvidenceSignature().
   *
   * @param {object} evidence  - Parsed evidence JSON object
   * @param {Buffer} signature - 64-byte IEEE P1363 raw signature
   * @returns {Promise<object>}
   */
  async verifyEvidenceSignature(evidence, signature) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const valid = await this.verifyDigestSignature(digestDetails.digest, signature);
    const verifiedAt = new Date().toISOString();

    const result = {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      digestHex: digestDetails.digestHex,
      valid,
    };

    // Fire-and-forget audit log
    if (this._logger) {
      this._logger.logSigningEvent({
        eventType: 'VERIFY',
        evidenceId: evidence.evidenceId || '',
        digestHex: digestDetails.digestHex,
        kmsKeyId: this._keyId,
        signingAlgorithm: KMS_SIGNING_ALGORITHM,
        signedAt: verifiedAt,
        status: 'SUCCESS',
        valid,
      }).catch(console.error);
    }

    return result;
  }
}

module.exports = {
  SIGNATURE_ALGORITHM,
  KMS_SIGNING_ALGORITHM,
  decodeDerSignatureToRaw,
  AwsKmsProvider,
};
