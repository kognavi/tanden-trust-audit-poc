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

function signRawMessage(message, privateKeyPem) {
  return defaultSignatureProvider.signRawMessage(message, privateKeyPem);
}

function verifyRawMessageSignature(message, signature, publicKeyPem) {
  return defaultSignatureProvider.verifyRawMessageSignature(message, signature, publicKeyPem);
}

/** @deprecated Use signRawMessage(). Input remains raw pre-hash bytes. */
function signDigest(message, privateKeyPem) {
  return signRawMessage(message, privateKeyPem);
}

/** @deprecated Use verifyRawMessageSignature(). Input remains raw pre-hash bytes. */
function verifyDigestSignature(message, signature, publicKeyPem) {
  return verifyRawMessageSignature(message, signature, publicKeyPem);
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
  signRawMessage,
  verifyRawMessageSignature,
  signDigest,
  verifyDigestSignature,
  signEvidence,
  verifyEvidenceSignature,
};
