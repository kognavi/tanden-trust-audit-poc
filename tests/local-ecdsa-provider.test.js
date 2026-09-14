const test = require('node:test');
const assert = require('node:assert/strict');

const crypto = require('node:crypto');
const {
  LocalEcdsaProvider,
} = require('../lib/local-ecdsa-provider');

const sampleEvidence = {
  evidenceId: 'evd-2026-local-provider-001',
  schemaVersion: '1.0.0',
  eventType: 'CONSENT_GRANTED',
  subjectId: 'subject-demo-001',
  actorId: 'actor-demo-001',
  sourceSystem: 'tanden-trust-audit-poc',
  occurredAt: '2026-06-02T03:00:00Z',
  purpose: 'Verify LocalEcdsaProvider signing and verification behavior.',
  hashAlgorithm: 'SHA-256',
  consent: {
    status: 'granted',
    scope: ['activity_recording', 'audit_verification'],
    version: 'v1.0',
  },
  metadata: {
    environment: 'test',
    containsPersonalData: false,
    notes: 'Synthetic test data for LocalEcdsaProvider coverage.',
  },
};

test('LocalEcdsaProvider generates an EC key pair', () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  assert.equal(typeof publicKey, 'string');
  assert.equal(typeof privateKey, 'string');
  assert.match(publicKey, /-----BEGIN PUBLIC KEY-----/);
  assert.match(privateKey, /-----BEGIN PRIVATE KEY-----/);
});

test('LocalEcdsaProvider signs and verifies evidence', async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signed = await provider.signEvidence(sampleEvidence, privateKey);
  const verified = await provider.verifyEvidenceSignature(
    sampleEvidence,
    signed.signature,
    publicKey
  );

  assert.equal(signed.canonicalization, 'RFC 8785 JSON Canonicalization Scheme (JCS)');
  assert.equal(signed.hashAlgorithm, 'SHA-256');
  assert.equal(signed.signatureAlgorithm, 'ECDSA_SHA_256');
  assert.equal(typeof signed.canonicalJson, 'string');
  assert.equal(typeof signed.digestHex, 'string');
  assert.equal(signed.digestHex.length, 64);
  assert.ok(Buffer.isBuffer(signed.signature));
  assert.equal(typeof signed.signatureBase64, 'string');

  assert.equal(verified.canonicalization, signed.canonicalization);
  assert.equal(verified.hashAlgorithm, signed.hashAlgorithm);
  assert.equal(verified.signatureAlgorithm, signed.signatureAlgorithm);
  assert.equal(verified.digestHex, signed.digestHex);
  assert.equal(verified.valid, true);
});

test('LocalEcdsaProvider returns invalid when evidence is tampered after signing', async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signed = await provider.signEvidence(sampleEvidence, privateKey);

  const tamperedEvidence = {
    ...sampleEvidence,
    consent: {
      ...sampleEvidence.consent,
      status: 'revoked',
    },
  };

  const verified = await provider.verifyEvidenceSignature(
    tamperedEvidence,
    signed.signature,
    publicKey
  );

  assert.equal(verified.valid, false);
  assert.notEqual(verified.digestHex, signed.digestHex);
});

test('LocalEcdsaProvider returns invalid when verified with a different public key', async () => {
  const provider = new LocalEcdsaProvider();

  const firstKeyPair = provider.generateEcKeyPair();
  const secondKeyPair = provider.generateEcKeyPair();

  const signed = await provider.signEvidence(sampleEvidence, firstKeyPair.privateKey);

  const verified = await provider.verifyEvidenceSignature(
    sampleEvidence,
    signed.signature,
    secondKeyPair.publicKey
  );

  assert.equal(verified.digestHex, signed.digestHex);
  assert.equal(verified.valid, false);
});

test('LocalEcdsaProvider returns false for a wrong-length signature without verifying it', () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey } = provider.generateEcKeyPair();
  const digest = crypto.createHash('sha256').update('test').digest();

  const malformedSignature = Buffer.from('too-short-sig');
  assert.equal(
    provider.verifyRawMessageSignature(digest, malformedSignature, publicKey),
    false
  );
});

test('LocalEcdsaProvider rejects a non-secp256k1 key', () => {
  const provider = new LocalEcdsaProvider();
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  assert.throws(
    () => provider.signRawMessage(Buffer.from('message'), privateKey),
    /Expected secp256k1/
  );
});

test('LocalEcdsaProvider keeps legacy raw-message aliases compatible', () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();
  const message = Buffer.from('legacy raw message');

  const signature = provider.signDigest(message, privateKey);

  assert.equal(provider.verifyRawMessageSignature(message, signature, publicKey), true);
  assert.equal(provider.verifyDigestSignature(message, signature, publicKey), true);
});
