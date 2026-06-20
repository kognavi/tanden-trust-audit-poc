const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateEcKeyPair,
  signEvidence,
  verifyEvidenceSignature,
} = require('../lib/signature');

const sampleEvidence = {
  evidenceId: 'evd-2026-000001',
  schemaVersion: '1.0.0',
  eventType: 'CONSENT_GRANTED',
  subjectId: 'subject-demo-001',
  actorId: 'actor-demo-001',
  sourceSystem: 'tanden-trust-audit-poc',
  occurredAt: '2026-06-02T03:00:00Z',
  purpose: 'Demonstrate tamper-evident consent evidence for a prototype audit trail.',
  hashAlgorithm: 'SHA-256',
  consent: {
    status: 'granted',
    scope: ['activity_recording', 'audit_verification'],
    version: 'v1.0',
  },
  metadata: {
    environment: 'demo',
    containsPersonalData: false,
    notes: 'This is synthetic sample data for demonstration only.',
  },
};

test('signs and verifies canonical evidence digest', async () => {
  const { privateKey, publicKey } = generateEcKeyPair();

  const signed = await signEvidence(sampleEvidence, privateKey);
  const verified = await verifyEvidenceSignature(sampleEvidence, signed.signature, publicKey);

  assert.equal(signed.signatureAlgorithm, 'ECDSA_SHA_256');
  assert.equal(signed.hashAlgorithm, 'SHA-256');
  assert.equal(verified.valid, true);
});

test('returns invalid when evidence is tampered after signing', async () => {
  const { privateKey, publicKey } = generateEcKeyPair();

  const signed = await signEvidence(sampleEvidence, privateKey);

  const tamperedEvidence = {
    ...sampleEvidence,
    consent: {
      ...sampleEvidence.consent,
      status: 'revoked',
    },
  };

  const verified = await verifyEvidenceSignature(tamperedEvidence, signed.signature, publicKey);

  assert.equal(verified.valid, false);
});

test('produces the same digest for objects with different key order', async () => {
  const { privateKey, publicKey } = generateEcKeyPair();

  const reorderedEvidence = {
    metadata: sampleEvidence.metadata,
    consent: sampleEvidence.consent,
    hashAlgorithm: sampleEvidence.hashAlgorithm,
    purpose: sampleEvidence.purpose,
    occurredAt: sampleEvidence.occurredAt,
    sourceSystem: sampleEvidence.sourceSystem,
    actorId: sampleEvidence.actorId,
    subjectId: sampleEvidence.subjectId,
    eventType: sampleEvidence.eventType,
    schemaVersion: sampleEvidence.schemaVersion,
    evidenceId: sampleEvidence.evidenceId,
  };

  const signed = await signEvidence(sampleEvidence, privateKey);
  const verified = await verifyEvidenceSignature(reorderedEvidence, signed.signature, publicKey);

  assert.equal(verified.valid, true);
});

test('returns invalid when verified with a different public key', async () => {
  const firstKeyPair = generateEcKeyPair();
  const secondKeyPair = generateEcKeyPair();

  const signed = await signEvidence(sampleEvidence, firstKeyPair.privateKey);
  const verified = await verifyEvidenceSignature(sampleEvidence, signed.signature, secondKeyPair.publicKey);

  assert.equal(verified.valid, false);
});
