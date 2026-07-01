"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { S3JsonObjectStore } = require("../lib/s3-json-object-store");
const { getEvidenceDigestDetails } = require("../lib/signature-digest");
const { signSidecarMetadata } = require("../lib/metadata-signature");
const {
  verifyEvidenceWithSidecarMetadata,
} = require("../lib/sidecar-verifier");

class InMemoryS3Client {
  constructor() {
    this.objects = new Map();
    this.commands = [];
  }

  makeObjectId(bucket, key) {
    return `${bucket}/${key}`;
  }

  async send(command) {
    this.commands.push(command);

    if (command.constructor.name === "PutObjectCommand") {
      const { Bucket, Key, Body, ContentType } = command.input;

      this.objects.set(this.makeObjectId(Bucket, Key), {
        Body,
        ContentType,
      });

      return {
        ETag: '"fake-etag"',
      };
    }

    if (command.constructor.name === "GetObjectCommand") {
      const { Bucket, Key } = command.input;
      const object = this.objects.get(this.makeObjectId(Bucket, Key));

      if (!object) {
        const error = new Error("No such key");
        error.name = "NoSuchKey";
        error.$metadata = {
          httpStatusCode: 404,
        };
        throw error;
      }

      return {
        Body: Readable.from([object.Body]),
        ContentType: object.ContentType,
      };
    }

    throw new Error(`Unsupported command: ${command.constructor.name}`);
  }
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
    evidenceVersionId: "s3-test-version-id",
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

test("S3 sidecar E2E stores, loads, and verifies evidence with metadata", async () => {
  const client = new InMemoryS3Client();
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

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

  assert.equal(client.commands.length, 4);
  assert.equal(client.commands[0].constructor.name, "PutObjectCommand");
  assert.equal(client.commands[1].constructor.name, "PutObjectCommand");
  assert.equal(client.commands[2].constructor.name, "GetObjectCommand");
  assert.equal(client.commands[3].constructor.name, "GetObjectCommand");
});

test("S3 sidecar E2E detects tampered stored evidence", async () => {
  const client = new InMemoryS3Client();
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

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

test("S3 sidecar E2E detects tampered stored metadata", async () => {
  const client = new InMemoryS3Client();
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

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

test("S3 sidecar E2E maps missing stored metadata to OBJECT_NOT_FOUND", async () => {
  const client = new InMemoryS3Client();
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  await store.putJsonObject("evidence/evidence-001.json", evidence);

  await assert.rejects(
    async () => store.getJsonObject("metadata/evidence-001.metadata.json"),
    (error) => {
      assert.equal(error.code, "OBJECT_NOT_FOUND");
      return true;
    }
  );
});
