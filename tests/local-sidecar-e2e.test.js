"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { LocalJsonObjectStore } = require("../lib/json-object-store");
const { getEvidenceDigestDetails } = require("../lib/signature-digest");
const { signSidecarMetadata } = require("../lib/metadata-signature");
const {
  verifyEvidenceWithSidecarMetadata,
} = require("../lib/sidecar-verifier");

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "tanden-local-e2e-"));
}

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

  const unsignedMetadata = {
    schemaVersion: "tanden.trust.metadata.v1",
    evidenceId: evidenceValue.evidenceId,
    evidenceKey: `evidence/${evidenceValue.evidenceId}.json`,
    evidenceVersionId: "local-test-version-id",
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

  return signSidecarMetadata(unsignedMetadata, privateKeyPem, provider);
}

test("local sidecar E2E stores, loads, and verifies evidence with metadata", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const evidenceKey = signedMetadata.evidenceKey;
  const metadataKey = `metadata/${evidence.evidenceId}.metadata.json`;

  await store.putJsonObject(evidenceKey, evidence);
  await store.putJsonObject(metadataKey, signedMetadata);

  const loadedEvidence = await store.getJsonObject(evidenceKey);
  const loadedMetadata = await store.getJsonObject(metadataKey);

  const result = await verifyEvidenceWithSidecarMetadata(
    loadedEvidence,
    loadedMetadata,
    publicKey
  );

  assert.equal(result.valid, true);
  assert.equal(result.digestMatches, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.evidenceDigestHex, loadedMetadata.digest);
});

test("local sidecar E2E detects tampered stored evidence", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const evidenceKey = signedMetadata.evidenceKey;
  const metadataKey = `metadata/${evidence.evidenceId}.metadata.json`;

  await store.putJsonObject(evidenceKey, evidence);
  await store.putJsonObject(metadataKey, signedMetadata);

  const tamperedEvidence = {
    ...evidence,
    action: "consent.revoked",
  };

  await store.putJsonObject(evidenceKey, tamperedEvidence);

  const loadedEvidence = await store.getJsonObject(evidenceKey);
  const loadedMetadata = await store.getJsonObject(metadataKey);

  const result = await verifyEvidenceWithSidecarMetadata(
    loadedEvidence,
    loadedMetadata,
    publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "DIGEST_MISMATCH");
  assert.equal(result.digestMatches, false);
  assert.equal(result.signatureValid, true);
});

test("local sidecar E2E detects tampered stored metadata", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await createSignedMetadataForEvidence(
    evidence,
    privateKey,
    provider
  );

  const evidenceKey = signedMetadata.evidenceKey;
  const metadataKey = `metadata/${evidence.evidenceId}.metadata.json`;

  await store.putJsonObject(evidenceKey, evidence);
  await store.putJsonObject(metadataKey, signedMetadata);

  const tamperedMetadata = {
    ...signedMetadata,
    evidenceKey: "evidence/tampered.json",
  };

  await store.putJsonObject(metadataKey, tamperedMetadata);

  const loadedEvidence = await store.getJsonObject(evidenceKey);
  const loadedMetadata = await store.getJsonObject(metadataKey);

  const result = await verifyEvidenceWithSidecarMetadata(
    loadedEvidence,
    loadedMetadata,
    publicKey
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "INVALID_METADATA_SIGNATURE");
  assert.equal(result.digestMatches, true);
  assert.equal(result.signatureValid, false);
});
