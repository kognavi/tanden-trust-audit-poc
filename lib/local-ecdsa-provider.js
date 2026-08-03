const crypto = require('node:crypto');

const {
  getEvidenceDigestDetails,
} = require('./signature-digest');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';

/**
 * Local ECDSA secp256k1 signature provider.
 *
 * This provider is intended for local development and PoC verification.
 * Production deployments can replace this provider with an AWS KMS-backed
 * provider while keeping the higher-level evidence signing flow unchanged.
 */
class LocalEcdsaProvider {
  generateEcKeyPair() {
    return crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1', // Fix: was 'prime256v1' (P-256), now matches
                                // AWS KMS ECC_SECG_P256K1 curve.
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
  }

  /**
   * Sign a message using ECDSA_SHA_256.
   *
   * IMPORTANT: `message` must be the RAW pre-hash bytes (i.e. the UTF-8
   * canonical JSON buffer), NOT a pre-computed SHA-256 digest.
   * crypto.sign('sha256', message, key) hashes `message` internally
   * exactly once. This matches AWS KMS's MessageType: 'RAW' contract
   * (KMS also hashes internally exactly once), keeping this provider
   * byte-for-byte interchangeable with AwsKmsProvider.
   *
   * (Fix: previously this received an already-hashed digest and
   * double-hashed it — SHA256(SHA256(canonicalJson)) — which silently
   * diverged from what AWS KMS actually signs.)
   */
  signDigest(message, privateKeyPem) {
    return crypto.sign('sha256', message, {
      key: privateKeyPem,
      dsaEncoding: 'ieee-p1363',
    });
  }

  verifyDigestSignature(message, signature, publicKeyPem) {
    return crypto.verify('sha256', message, {
      key: publicKeyPem,
      dsaEncoding: 'ieee-p1363',
    }, signature);
  }

  async signEvidence(evidence, privateKeyPem) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const message = Buffer.from(digestDetails.canonicalJson, 'utf8');
    const signature = this.signDigest(message, privateKeyPem);

    return {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      canonicalJson: digestDetails.canonicalJson,
      digestHex: digestDetails.digestHex,
      signature,
      signatureBase64: signature.toString('base64'),
    };
  }

  async verifyEvidenceSignature(evidence, signature, publicKeyPem) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const message = Buffer.from(digestDetails.canonicalJson, 'utf8');
    const valid = this.verifyDigestSignature(message, signature, publicKeyPem);

    return {
      canonicalization: digestDetails.canonicalization,
      hashAlgorithm: digestDetails.hashAlgorithm,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      digestHex: digestDetails.digestHex,
      valid,
    };
  }
}

module.exports = {
  SIGNATURE_ALGORITHM,
  LocalEcdsaProvider,
};
