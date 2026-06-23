const crypto = require('node:crypto');
const fs = require('node:fs');

const HASH_ALGORITHM = 'SHA-256';
const CANONICALIZATION = 'RFC 8785 JSON Canonicalization Scheme (JCS)';

let canonicalizeFunctionPromise;

function loadCanonicalizeFunction() {
  if (!canonicalizeFunctionPromise) {
    canonicalizeFunctionPromise = import('canonicalize').then((module) => {
      const canonicalize = module.default || module;

      if (typeof canonicalize !== 'function') {
        throw new Error('Failed to load canonicalize function');
      }

      return canonicalize;
    });
  }

  return canonicalizeFunctionPromise;
}

async function canonicalizeEvidence(evidence) {
  const canonicalize = await loadCanonicalizeFunction();
  const canonicalJson = canonicalize(evidence);

  if (typeof canonicalJson !== 'string') {
    throw new Error('Failed to canonicalize evidence');
  }

  return canonicalJson;
}

function calculateDigestFromCanonicalJson(canonicalJson) {
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest();
}

function calculateDigestHexFromCanonicalJson(canonicalJson) {
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

function loadEvidenceFromFile(evidenceFilePath) {
  const raw = fs.readFileSync(evidenceFilePath, 'utf8');
  return JSON.parse(raw);
}

async function getEvidenceDigestDetails(evidence) {
  const canonicalJson = await canonicalizeEvidence(evidence);
  const digest = calculateDigestFromCanonicalJson(canonicalJson);
  const digestHex = calculateDigestHexFromCanonicalJson(canonicalJson);

  return {
    canonicalization: CANONICALIZATION,
    hashAlgorithm: HASH_ALGORITHM,
    canonicalJson,
    digest,
    digestHex,
  };
}

module.exports = {
  HASH_ALGORITHM,
  CANONICALIZATION,
  loadCanonicalizeFunction,
  canonicalizeEvidence,
  calculateDigestFromCanonicalJson,
  calculateDigestHexFromCanonicalJson,
  loadEvidenceFromFile,
  getEvidenceDigestDetails,
};
