"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  omitSignature,
  createMetadataSigningPayload,
} = require("../lib/metadata-signing");

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

test("omitSignature removes signature field", () => {
  const result = omitSignature(validMetadata);

  assert.equal(result.signature, undefined);
  assert.equal(result.evidenceId, "evidence-001");
  assert.equal(result.digest, validMetadata.digest);
});

test("createMetadataSigningPayload returns canonical JSON without signature", async () => {
  const payload = await createMetadataSigningPayload(validMetadata);

  assert.equal(typeof payload, "string");
  assert.ok(!payload.includes("test-signature"));
  assert.ok(!payload.includes('"signature"'));
  assert.ok(payload.includes('"evidenceId":"evidence-001"'));
  assert.ok(
    payload.includes(
      '"digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'
    )
  );
});

test("createMetadataSigningPayload is stable regardless of input key order", async () => {
  const reorderedMetadata = {
    signingTarget: validMetadata.signingTarget,
    signedAt: validMetadata.signedAt,
    publicKeyRef: validMetadata.publicKeyRef,
    keyId: validMetadata.keyId,
    signature: validMetadata.signature,
    signatureEncoding: validMetadata.signatureEncoding,
    signatureAlgorithm: validMetadata.signatureAlgorithm,
    digest: validMetadata.digest,
    digestEncoding: validMetadata.digestEncoding,
    digestAlgorithm: validMetadata.digestAlgorithm,
    canonicalization: validMetadata.canonicalization,
    evidenceVersionId: validMetadata.evidenceVersionId,
    evidenceKey: validMetadata.evidenceKey,
    evidenceId: validMetadata.evidenceId,
    schemaVersion: validMetadata.schemaVersion,
  };

  const payloadA = await createMetadataSigningPayload(validMetadata);
  const payloadB = await createMetadataSigningPayload(reorderedMetadata);

  assert.equal(payloadA, payloadB);
});

test("createMetadataSigningPayload is unchanged when only signature changes", async () => {
  const metadataWithDifferentSignature = {
    ...validMetadata,
    signature: "another-signature",
  };

  const payloadA = await createMetadataSigningPayload(validMetadata);
  const payloadB = await createMetadataSigningPayload(metadataWithDifferentSignature);

  assert.equal(payloadA, payloadB);
});

test("createMetadataSigningPayload throws for invalid metadata", async () => {
  await assert.rejects(
    async () =>
      createMetadataSigningPayload({
        ...validMetadata,
        digest: "invalid-digest",
      }),
    (error) => {
      assert.equal(error.code, "INVALID_SIDECAR_METADATA");
      assert.ok(
        error.validationErrors.includes(
          "digest must be a lowercase SHA-256 hex string"
        )
      );
      return true;
    }
  );
});
