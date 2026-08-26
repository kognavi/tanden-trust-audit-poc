"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateSidecarMetadataV2,
} = require("../lib/metadata");

const validMetadata = {
  schemaVersion: "tanden.trust.metadata.v2",
  evidenceId: "evidence-001",
  evidenceKey: "evidence/evidence-001.json",
  evidenceVersionId: "test-version-id",
  canonicalization: "JCS",
  digestAlgorithm: "SHA-256",
  digestEncoding: "hex",
  digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  signatureAlgorithm: "ECDSA_SHA_256",
  signatureCurve: "secp256k1",
  signatureEncoding: "base64url",
  signature: "test-signature",
  keyId: "local-dev-key-001",
  publicKeyRef: "trusted-keys/local-dev-key-001.pem",
  signedAt: "2026-06-28T10:00:05Z",
  signingTarget: "metadata_without_signature",
};

test("validateSidecarMetadataV2 accepts valid metadata", () => {
  const result = validateSidecarMetadataV2(validMetadata);

  assert.equal(result.ok, true);

  assert.equal(result.value.evidenceId, "evidence-001");
  assert.equal(result.value.evidenceVersionId, "test-version-id");
});

test("validateSidecarMetadataV2 accepts metadata without optional evidenceVersionId", () => {
  const { evidenceVersionId, ...metadataWithoutVersionId } = validMetadata;

  const result = validateSidecarMetadataV2(metadataWithoutVersionId);

  assert.equal(result.ok, true);
  assert.equal(result.value.evidenceVersionId, undefined);
});

test("validateSidecarMetadataV2 rejects missing required fields", () => {
  const { evidenceId, ...metadataWithoutEvidenceId } = validMetadata;

  const result = validateSidecarMetadataV2(metadataWithoutEvidenceId);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("evidenceId must be a non-empty string"));
});

test("validateSidecarMetadataV2 rejects invalid schemaVersion", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    schemaVersion: "invalid",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("schemaVersion must be tanden.trust.metadata.v2")
  );
});

test("validateSidecarMetadataV2 rejects legacy v1 metadata", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    schemaVersion: "tanden.trust.metadata.v1",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("schemaVersion must be tanden.trust.metadata.v2")
  );
});

test("validateSidecarMetadataV2 rejects invalid digest format", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    digest: "not-a-sha256-hex",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("digest must be a lowercase SHA-256 hex string")
  );
});

test("validateSidecarMetadataV2 rejects uppercase digest", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    digest:
      "3B7F4F9F4C8A1E0F2D7C9E0B1A6C5D4E3F2A1B0C9D8E7F6A5B4C3D2E1F0A9B8C7",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("digest must be a lowercase SHA-256 hex string")
  );
});

test("validateSidecarMetadataV2 rejects invalid signedAt format", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    signedAt: "2026-06-28 10:00:05",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("signedAt must be an ISO-8601 UTC timestamp")
  );
});

test("validateSidecarMetadataV2 rejects invalid evidenceVersionId", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    evidenceVersionId: "",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes(
      "evidenceVersionId must be a non-empty string when provided"
    )
  );
});

test("validateSidecarMetadataV2 rejects non-object metadata", () => {
  const result = validateSidecarMetadataV2(null);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("metadata must be an object"));
});

test("validateSidecarMetadataV2 rejects the legacy P-256 algorithm identifier", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    signatureAlgorithm: "ECDSA_P256_SHA256",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("signatureAlgorithm must be ECDSA_SHA_256"));
});

test("validateSidecarMetadataV2 requires the secp256k1 signature curve", () => {
  const result = validateSidecarMetadataV2({
    ...validMetadata,
    signatureCurve: "prime256v1",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("signatureCurve must be secp256k1"));
});
