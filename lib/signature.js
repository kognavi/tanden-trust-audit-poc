const crypto = require('node:crypto');
const fs = require('node:fs');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';
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

function generateEcKeyPair() {
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

function signDigest(digest, privateKeyPem) {
  return crypto.sign('sha256', digest, {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });
}

function verifyDigestSignature(digest, signature, publicKeyPem) {
  return crypto.verify('sha256', digest, {
    key: publicKeyPem,
    dsaEncoding: 'ieee-p1363',
  }, signature);
}

async function signEvidence(evidence, privateKeyPem) {
  const digestDetails = await getEvidenceDigestDetails(evidence);
  const signature = signDigest(digestDetails.digest, privateKeyPem);

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

async function verifyEvidenceSignature(evidence, signature, publicKeyPem) {
  const digestDetails = await getEvidenceDigestDetails(evidence);
  const valid = verifyDigestSignature(digestDetails.digest, signature, publicKeyPem);

  return {
    canonicalization: digestDetails.canonicalization,
    hashAlgorithm: digestDetails.hashAlgorithm,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    digestHex: digestDetails.digestHex,
    valid,
  };
}

module.exports = {
  SIGNATURE_ALGORITHM,
  HASH_ALGORITHM,
  CANONICALIZATION,
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
