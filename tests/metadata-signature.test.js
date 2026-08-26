"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { createMetadataSigningPayload } = require("../lib/metadata-signing");

const {
  calculateMetadataSigningDigestFromPayload,
  calculateMetadataSigningDigestHexFromPayload,
  getMetadataSigningDigestDetails,
  signSidecarMetadata,
  verifySidecarMetadataSignature,
} = require("../lib/metadata-signature");

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
  signature: "placeholder-signature",
  keyId: "local-dev-key-001",
  publicKeyRef: "trusted-keys/local-dev-key-001.pem",
  signedAt: "2026-06-28T10:00:05Z",
  signingTarget: "metadata_without_signature",
};

test("calculateMetadataSigningDigestFromPayload returns SHA-256 digest buffer", () => {
  const payload = '{"hello":"world"}';
  const digest = calculateMetadataSigningDigestFromPayload(payload);
  const digestHex = calculateMetadataSigningDigestHexFromPayload(payload);

  assert.ok(Buffer.isBuffer(digest));
  assert.equal(digest.length, 32);
  assert.equal(digestHex.length, 64);
  assert.equal(digest.toString("hex"), digestHex);
});

test("getMetadataSigningDigestDetails returns canonical payload and digest details", async () => {
  const details = await getMetadataSigningDigestDetails(validMetadata);

  assert.equal(typeof details.canonicalPayload, "string");
  assert.ok(!details.canonicalPayload.includes('"signature"'));
  assert.ok(Buffer.isBuffer(details.digest));
  assert.equal(details.digest.length, 32);
  assert.equal(details.digestHex.length, 64);
  assert.match(details.digestHex, /^[a-f0-9]{64}$/);
  assert.equal(
    details.digestHex,
    crypto.createHash("sha256").update(details.canonicalPayload, "utf8").digest("hex")
  );
  assert.equal(details.digestAlgorithm, "SHA-256");
  assert.equal(details.digestEncoding, "hex");
  assert.equal(details.signingTarget, "metadata_without_signature");
});

test("signSidecarMetadata passes raw canonical payload bytes to the provider", async () => {
  const canonicalPayload = await createMetadataSigningPayload(validMetadata);
  let receivedMessage;

  const provider = {
    async signDigest(message) {
      receivedMessage = message;
      return Buffer.alloc(64, 1);
    },
  };

  await signSidecarMetadata(validMetadata, "unused-key", provider);

  assert.deepEqual(receivedMessage, Buffer.from(canonicalPayload, "utf8"));
  assert.notEqual(receivedMessage.length, 32);
});

test("verifySidecarMetadataSignature passes raw canonical payload bytes to the provider", async () => {
  const canonicalPayload = await createMetadataSigningPayload(validMetadata);
  let receivedMessage;

  const provider = {
    async verifyDigestSignature(message) {
      receivedMessage = message;
      return true;
    },
  };

  const result = await verifySidecarMetadataSignature(validMetadata, "unused-key", provider);

  assert.equal(result.valid, true);
  assert.deepEqual(receivedMessage, Buffer.from(canonicalPayload, "utf8"));
  assert.notEqual(receivedMessage.length, 32);
});

test("signSidecarMetadata replaces placeholder signature with base64url signature", async () => {
  const provider = new LocalEcdsaProvider();
  const { privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await signSidecarMetadata(validMetadata, privateKey, provider);

  assert.equal(signedMetadata.schemaVersion, validMetadata.schemaVersion);
  assert.equal(signedMetadata.evidenceId, validMetadata.evidenceId);
  assert.equal(signedMetadata.signatureAlgorithm, "ECDSA_SHA_256");
  assert.equal(signedMetadata.signatureCurve, "secp256k1");
  assert.notEqual(signedMetadata.signature, validMetadata.signature);
  assert.match(signedMetadata.signature, /^[A-Za-z0-9_-]+$/);
});

test("verifySidecarMetadataSignature returns valid for signed metadata", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await signSidecarMetadata(validMetadata, privateKey, provider);
  const result = await verifySidecarMetadataSignature(signedMetadata, publicKey, provider);

  assert.equal(result.valid, true);
  assert.equal(result.digestHex.length, 64);
  assert.equal(result.signingTarget, "metadata_without_signature");
  assert.equal(result.signatureAlgorithm, "ECDSA_SHA_256");
  assert.equal(result.signatureCurve, "secp256k1");
  assert.equal(result.signatureEncoding, "base64url");
});

test("verifySidecarMetadataSignature returns invalid when metadata is tampered", async () => {
  const provider = new LocalEcdsaProvider();
  const { publicKey, privateKey } = provider.generateEcKeyPair();

  const signedMetadata = await signSidecarMetadata(validMetadata, privateKey, provider);
  const tamperedMetadata = {
    ...signedMetadata,
    evidenceKey: "evidence/tampered.json",
  };

  const result = await verifySidecarMetadataSignature(tamperedMetadata, publicKey, provider);

  assert.equal(result.valid, false);
});

test("verifySidecarMetadataSignature returns invalid when verified with another public key", async () => {
  const provider = new LocalEcdsaProvider();
  const keyPairA = provider.generateEcKeyPair();
  const keyPairB = provider.generateEcKeyPair();

  const signedMetadata = await signSidecarMetadata(
    validMetadata,
    keyPairA.privateKey,
    provider
  );

  const result = await verifySidecarMetadataSignature(
    signedMetadata,
    keyPairB.publicKey,
    provider
  );

  assert.equal(result.valid, false);
});

test("signSidecarMetadata throws for invalid metadata", async () => {
  const provider = new LocalEcdsaProvider();
  const { privateKey } = provider.generateEcKeyPair();

  await assert.rejects(
    async () =>
      signSidecarMetadata(
        {
          ...validMetadata,
          digest: "invalid-digest",
        },
        privateKey,
        provider
      ),
    (error) => {
      assert.equal(error.code, "INVALID_SIDECAR_METADATA");
      return true;
    }
  );
});
