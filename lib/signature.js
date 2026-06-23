const {
  HASH_ALGORITHM,
  CANONICALIZATION,
  loadCanonicalizeFunction,
  canonicalizeEvidence,
  calculateDigestFromCanonicalJson,
  calculateDigestHexFromCanonicalJson,
  loadEvidenceFromFile,
  getEvidenceDigestDetails,
} = require('./signature-digest');

const {
  SIGNATURE_ALGORITHM,
  LocalEcdsaProvider,
} = require('./local-ecdsa-provider');

const defaultSignatureProvider = new LocalEcdsaProvider();

function generateEcKeyPair() {
  return defaultSignatureProvider.generateEcKeyPair();
}

function signDigest(digest, privateKeyPem) {
  return defaultSignatureProvider.signDigest(digest, privateKeyPem);
}

function verifyDigestSignature(digest, signature, publicKeyPem) {
  return defaultSignatureProvider.verifyDigestSignature(digest, signature, publicKeyPem);
}

async function signEvidence(evidence, privateKeyPem) {
  return defaultSignatureProvider.signEvidence(evidence, privateKeyPem);
}

async function verifyEvidenceSignature(evidence, signature, publicKeyPem) {
  return defaultSignatureProvider.verifyEvidenceSignature(evidence, signature, publicKeyPem);
}

module.exports = {
  SIGNATURE_ALGORITHM,
  HASH_ALGORITHM,
  CANONICALIZATION,
  LocalEcdsaProvider,
  loadCanonicalizeFunction,
  canonicalizeEvidence,
  calculateDigestFromCanonicalJson,
  calculateDigestHexFromCanonicalJson,
  loadEvidenceFromFile,
  getEvidenceDigestDetails,
  generateEcKeyPair,
  signDigest,
  verifyDigestSignature,
  signEvidence,
  verifyEvidenceSignature,
};
