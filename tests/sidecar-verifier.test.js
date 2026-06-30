"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { getEvidenceDigestDetails } = require("../lib/signature-digest");
const { signSidecarMetadata } = require("../lib/metadata-signature");
const {
  verifyEvidenceWithSidecarMetadata,
} = require("../lib/sidecar-verifier");

const evidence = {
  evidenceId: "evidence-001",
  actor: {
    type: "user",
    id: "user-001",
  },
  action: "consent.granted",
  occurredAt: "2026-06-28T10:00:00Z",
  target: {
    type: "consent",
    id: "consent-001",
  },
};

async function createSignedMetadataForEvidence(
  evidenceValue,
  privateKeyPem,
  provider
) {
  const evidenceDigestDetails = await getEvidenceDigestDetails(evidenceValue);

  const metadata = {
    schemaVersion: "tanden.trust.metadata.v1",
    evidenceId: evidenceValue.evidenceId,
    evidenceKey: `evidence/${evidenceValue.evidenceId}.json`,
    evidenceVersionId: "test-version-id",
    canonicalization: "JCS",
    digestAlgorithm: "SHA-256",
    digestEncoding: "hex",
    digest: evidenceDigestDetails.digestHex,
    signatureAlgorithm: "ECDSA_P256_SHA256",
    signatureEncoding: "base64url",
    signature: "placeholder-signature",
    keyId: "local-dev-key-001",
    publicKeyRef: "trusted-keys/local-dev-key-001.pem",
    signedAt: "2026-06-28T10:00:05Z",
    signingTarget: "metadata_without_signature",
  };

  return signSidecarMetadata(metadata, privateKeyPem, provider);
}

test("verifyEvidenceWithSidecarMetadata returns valid for matching evidence and signed metadata", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const result = await verifyEvidenceWithSidecarMetadata(
    evidence,
    signedMetadata,
    publicKey
  );

  assert.equal(result.valid, true);
  assert.equal(result.digestMatches, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.evidenceDigestHex, result.metadataDigestHex);
});

test("verifyEvidenceWithSidecarMetadata rejects tampered evidence", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const tamperedEvidence = {
    ...evidence,
    action: "consent.revoked",
  };

  const result = await verifyEvidenceWithSidecarMetadata(
    tamperedEvidence,
    signedMetadata,
    publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "DIGEST_MISMATCH");
  assert.equal(result.digestMatches, false);
  assert.equal(result.signatureValid, true);
});

test("verifyEvidenceWithSidecarMetadata rejects tampered metadata", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const tamperedMetadata = {
    ...signedMetadata,
    evidenceKey: "evidence/tampered.json",
  };

  const result = await verifyEvidenceWithSidecarMetadata(
    evidence,
    tamperedMetadata,
    publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "INVALID_METADATA_SIGNATURE");
  assert.equal(result.digestMatches, true);
  assert.equal(result.signatureValid, false);
});

test("verifyEvidenceWithSidecarMetadata rejects metadata signed by another key", async () => {
  const provider = new LocalEcdsaProvider();
  const keyPairA = provider.generateEcKeyPair();
  const keyPairB = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    keyPairA.privateKey,
    provider
  );

  const result = await verifyEvidenceWithSidecarMetadata(
    evidence,
    signedMetadata,
    keyPairB.publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "INVALID_METADATA_SIGNATURE");
  assert.equal(result.digestMatches, true);
  assert.equal(result.signatureValid, false);
});

test("verifyEvidenceWithSidecarMetadata rejects invalid metadata schema", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey } = provider.generateEcKeyPair();

  const invalidMetadata = {
    schemaVersion: "invalid",
  };

  const result = await verifyEvidenceWithSidecarMetadata(
    evidence,
    invalidMetadata,
    publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "INVALID_SIDECAR_METADATA");
  assert.equal(result.digestMatches, false);
  assert.equal(result.signatureValid, false);
  assert.ok(result.metadataErrors.length > 0);
});
