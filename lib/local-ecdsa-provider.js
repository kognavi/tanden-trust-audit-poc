const crypto = require('node:crypto');

const {
  getEvidenceDigestDetails,
} = require('./signature-digest');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';

/**
 * Local ECDSA P-256 signature provider.
 *
 * This provider is intended for local development and PoC verification.
 * Production deployments can replace this provider with an AWS KMS-backed
 * provider while keeping the higher-level evidence signing flow unchanged.
 */
class LocalEcdsaProvider {
  generateEcKeyPair() {
    return crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
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

  signDigest(digest, privateKeyPem) {
    return crypto.sign('sha256', digest, {
      key: privateKeyPem,
      dsaEncoding: 'ieee-p1363',
    });
  }

  verifyDigestSignature(digest, signature, publicKeyPem) {
    return crypto.verify('sha256', digest, {
      key: publicKeyPem,
      dsaEncoding: 'ieee-p1363',
    }, signature);
  }

  async signEvidence(evidence, privateKeyPem) {
    const digestDetails = await getEvidenceDigestDetails(evidence);
    const signature = this.signDigest(digestDetails.digest, privateKeyPem);

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
    const valid = this.verifyDigestSignature(digestDetails.digest, signature, publicKeyPem);

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
