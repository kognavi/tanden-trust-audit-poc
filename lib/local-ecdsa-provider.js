const crypto = require('node:crypto');

const {
  getEvidenceDigestDetails,
} = require('./signature-digest');

const {
  SIGNATURE_ALGORITHM,
  SIGNATURE_CURVE,
  SIGNATURE_ENCODING,
  assertRawMessage,
  assertRawSignature,
  assertSecp256k1Key,
} = require('./signing-contract');

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
      namedCurve: SIGNATURE_CURVE,
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
  signRawMessage(message, privateKeyPem) {
    assertRawMessage(message);
    const privateKey = assertSecp256k1Key(privateKeyPem, 'private');
    return crypto.sign('sha256', message, {
      key: privateKey,
      dsaEncoding: SIGNATURE_ENCODING,
    });
  }

  verifyRawMessageSignature(message, signature, publicKeyPem) {
    assertRawMessage(message);
    try {
      assertRawSignature(signature);
    } catch {
      return false;
    }
    const publicKey = assertSecp256k1Key(publicKeyPem, 'public');
    return crypto.verify('sha256', message, {
      key: publicKey,
      dsaEncoding: SIGNATURE_ENCODING,
    }, signature);
  }

  /** @deprecated Use signRawMessage(). Input remains raw pre-hash bytes. */
  signDigest(message, privateKeyPem) {
    return this.signRawMessage(message, privateKeyPem);
  }

  /** @deprecated Use verifyRawMessageSignature(). Input remains raw pre-hash bytes. */
  verifyDigestSignature(message, signature, publicKeyPem) {
    return this.verifyRawMessageSignature(message, signature, publicKeyPem);
  }

  async signEvidence(evidence, privateKeyPem) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const message = Buffer.from(digestDetails.canonicalJson, 'utf8');
    const signature = this.signRawMessage(message, privateKeyPem);

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
    const valid = this.verifyRawMessageSignature(message, signature, publicKeyPem);

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
