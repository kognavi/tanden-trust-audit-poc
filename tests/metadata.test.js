"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateSidecarMetadataV1,
} = require("../lib/metadata");

const validMetadata = {
  schemaVersion: "tanden.trust.metadata.v1",
  evidenceId: "evidence-001",
  evidenceKey: "evidence/evidence-001.json",
  evidenceVersionId: "test-version-id",
  canonicalization: "JCS",
  digestAlgorithm: "SHA-256",
  digestEncoding: "hex",
  digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  signatureAlgorithm: "ECDSA_P256_SHA256",
  signatureEncoding: "base64url",
  signature: "test-signature",
  keyId: "local-dev-key-001",
  publicKeyRef: "trusted-keys/local-dev-key-001.pem",
  signedAt: "2026-06-28T10:00:05Z",
  signingTarget: "metadata_without_signature",
};

test("validateSidecarMetadataV1 accepts valid metadata", () => {
  const result = validateSidecarMetadataV1(validMetadata);

  assert.equal(result.ok, true);

  assert.equal(result.value.evidenceId, "evidence-001");
  assert.equal(result.value.evidenceVersionId, "test-version-id");
});

test("validateSidecarMetadataV1 accepts metadata without optional evidenceVersionId", () => {
  const { evidenceVersionId, ...metadataWithoutVersionId } = validMetadata;

  const result = validateSidecarMetadataV1(metadataWithoutVersionId);

  assert.equal(result.ok, true);
  assert.equal(result.value.evidenceVersionId, undefined);
});

test("validateSidecarMetadataV1 rejects missing required fields", () => {
  const { evidenceId, ...metadataWithoutEvidenceId } = validMetadata;

  const result = validateSidecarMetadataV1(metadataWithoutEvidenceId);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("evidenceId must be a non-empty string"));
});

test("validateSidecarMetadataV1 rejects invalid schemaVersion", () => {
  const result = validateSidecarMetadataV1({
    ...validMetadata,
    schemaVersion: "invalid",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("schemaVersion must be tanden.trust.metadata.v1")
  );
});

test("validateSidecarMetadataV1 rejects invalid digest format", () => {
  const result = validateSidecarMetadataV1({
    ...validMetadata,
    digest: "not-a-sha256-hex",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("digest must be a lowercase SHA-256 hex string")
  );
});

test("validateSidecarMetadataV1 rejects uppercase digest", () => {
  const result = validateSidecarMetadataV1({
    ...validMetadata,
    digest:
      "3B7F4F9F4C8A1E0F2D7C9E0B1A6C5D4E3F2A1B0C9D8E7F6A5B4C3D2E1F0A9B8C7",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("digest must be a lowercase SHA-256 hex string")
  );
});

test("validateSidecarMetadataV1 rejects invalid signedAt format", () => {
  const result = validateSidecarMetadataV1({
    ...validMetadata,
    signedAt: "2026-06-28 10:00:05",
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("signedAt must be an ISO-8601 UTC timestamp")
  );
});

test("validateSidecarMetadataV1 rejects invalid evidenceVersionId", () => {
  const result = validateSidecarMetadataV1({
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

test("validateSidecarMetadataV1 rejects non-object metadata", () => {
  const result = validateSidecarMetadataV1(null);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("metadata must be an object"));
});
