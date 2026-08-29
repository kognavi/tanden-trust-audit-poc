"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const { signSidecarMetadata } = require("../lib/metadata-signature");
const { getEvidenceDigestDetails } = require("../lib/signature-digest");
const {
  VerifiedAnchorService,
  TrustedKeyResolver,
  VerificationGateError,
  AlreadyAnchoredError,
  AnchorTransactionError,
} = require("../lib/verified-anchor-service");

const evidence = {
  evidenceId: "evidence-anchor-001",
  actor: { type: "user", id: "user-001" },
  action: "consent.granted",
  occurredAt: "2026-08-29T00:00:00Z",
  target: { type: "consent", id: "consent-001" },
};

function makeClient({ anchoredAt = 0n, failure } = {}) {
  const calls = [];
  return {
    calls,
    async getAnchoredAt(digestBytes32) {
      calls.push({ method: "getAnchoredAt", args: [digestBytes32] });
      return anchoredAt;
    },
    async anchorDigest(...args) {
      calls.push({ method: "anchorDigest", args });
      if (failure) throw failure;
      return { transactionHash: "0xtx", blockNumber: 123 };
    },
  };
}

async function createFixture({ keyId = "local-dev-key-001", signer } = {}) {
  const provider = new LocalEcdsaProvider();
  const keyPair = signer ?? provider.generateEcKeyPair();
  const digest = (await getEvidenceDigestDetails(evidence)).digestHex;
  const unsignedMetadata = {
    schemaVersion: "tanden.trust.metadata.v2",
    evidenceId: evidence.evidenceId,
    evidenceKey: `evidence/${evidence.evidenceId}.json`,
    canonicalization: "JCS",
    digestAlgorithm: "SHA-256",
    digestEncoding: "hex",
    digest,
    signatureAlgorithm: "ECDSA_SHA_256",
    signatureCurve: "secp256k1",
    signatureEncoding: "base64url",
    signature: "placeholder",
    keyId,
    publicKeyRef: `trusted-keys/${keyId}.pem`,
    signedAt: "2026-08-29T00:00:01Z",
    signingTarget: "metadata_without_signature",
  };
  const metadata = await signSidecarMetadata(
    unsignedMetadata,
    keyPair.privateKey,
    provider
  );
  return { provider, keyPair, metadata, digest };
}

function makeService(client, trustedEntries) {
  return new VerifiedAnchorService({
    anchorClient: client,
    trustedKeyResolver: new TrustedKeyResolver(new Map(trustedEntries)),
  });
}

test("valid Evidence with a registered trusted key anchors only the recomputed bytes32 digest", async () => {
  const fixture = await createFixture();
  const client = makeClient();
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);

  const result = await service.anchorVerifiedEvidence({
    evidence,
    metadata: fixture.metadata,
    callerSuppliedPii: "not forwarded",
  });

  assert.equal(result.digestHex, fixture.digest);
  assert.equal(result.digestBytes32, `0x${fixture.digest}`);
  assert.deepEqual(client.calls, [
    { method: "getAnchoredAt", args: [`0x${fixture.digest}`] },
    { method: "anchorDigest", args: [`0x${fixture.digest}`] },
  ]);
  assert.equal(JSON.stringify(client.calls).includes("evidence-anchor-001"), false);
  assert.equal(JSON.stringify(client.calls).includes("signature"), false);
});

test("caller-forged verification booleans are not a production API input", async () => {
  const fixture = await createFixture();
  const client = makeClient();
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
  const attackerDigest = "b".repeat(64);

  assert.equal(service.anchorVerifiedResult, undefined);
  await assert.rejects(
    () => service.anchorVerifiedEvidence({
      valid: true,
      digestMatches: true,
      signatureValid: true,
      evidenceDigestHex: attackerDigest,
      metadataDigestHex: attackerDigest,
    }),
    (error) => error.code === "INVALID_SIDECAR_METADATA"
  );
  assert.deepEqual(client.calls, []);
});

test("unknown signed keyId fails closed before any Web3 call", async () => {
  const fixture = await createFixture({ keyId: "unknown-key" });
  const trusted = new LocalEcdsaProvider().generateEcKeyPair();
  const client = makeClient();
  const service = makeService(client, [["local-dev-key-001", trusted.publicKey]]);

  await assert.rejects(
    () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
    (error) => error.code === "UNTRUSTED_SIGNING_KEY"
  );
  assert.deepEqual(client.calls, []);
});

test("metadata signed by a different key than its registered keyId fails closed", async () => {
  const attacker = new LocalEcdsaProvider().generateEcKeyPair();
  const trusted = new LocalEcdsaProvider().generateEcKeyPair();
  const fixture = await createFixture({ signer: attacker });
  const client = makeClient();
  const service = makeService(client, [[fixture.metadata.keyId, trusted.publicKey]]);

  await assert.rejects(
    () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
    (error) => error.code === "VERIFICATION_NOT_APPROVED"
  );
  assert.deepEqual(client.calls, []);
});

test("caller cannot override the trusted resolver with an attacker public key", async () => {
  const attacker = new LocalEcdsaProvider().generateEcKeyPair();
  const trusted = new LocalEcdsaProvider().generateEcKeyPair();
  const fixture = await createFixture({ signer: attacker });
  const client = makeClient();
  const service = makeService(client, [[fixture.metadata.keyId, trusted.publicKey]]);

  await assert.rejects(
    () => service.anchorVerifiedEvidence({
      evidence,
      metadata: fixture.metadata,
      publicKeyPem: attacker.publicKey,
    }),
    (error) => error.code === "VERIFICATION_NOT_APPROVED"
  );
  assert.deepEqual(client.calls, []);
});

test("tampered Evidence, metadata, and signature fail before any Web3 call", async (t) => {
  const fixture = await createFixture();
  const cases = [
    ["Evidence", { evidence: { ...evidence, action: "consent.revoked" }, metadata: fixture.metadata }],
    ["metadata", { evidence, metadata: { ...fixture.metadata, evidenceKey: "evidence/tampered.json" } }],
    ["signature", { evidence, metadata: { ...fixture.metadata, signature: "invalid-signature" } }],
  ];

  for (const [name, input] of cases) {
    await t.test(name, async () => {
      const client = makeClient();
      const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
      await assert.rejects(
        () => service.anchorVerifiedEvidence(input),
        (error) => error.code === "VERIFICATION_NOT_APPROVED"
      );
      assert.deepEqual(client.calls, []);
    });
  }
});

test("signed zero metadata digest fails before any Web3 call", async () => {
  const fixture = await createFixture();
  const zeroDigestMetadata = await signSidecarMetadata(
    { ...fixture.metadata, digest: "0".repeat(64), signature: "placeholder" },
    fixture.keyPair.privateKey,
    fixture.provider
  );
  const client = makeClient();
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
  await assert.rejects(
    () => service.anchorVerifiedEvidence({
      evidence,
      metadata: zeroDigestMetadata,
    }),
    (error) => error.code === "VERIFICATION_NOT_APPROVED"
  );
  assert.deepEqual(client.calls, []);
});

test("already anchored and transaction failures retain explicit semantics", async (t) => {
  const fixture = await createFixture();
  await t.test("already anchored", async () => {
    const client = makeClient({ anchoredAt: 123n });
    const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
    await assert.rejects(
      () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
      (error) => error instanceof AlreadyAnchoredError && error.anchoredAt === "123"
    );
  });
  await t.test("transaction failure", async () => {
    const failure = new Error("RPC unavailable");
    const client = makeClient({ failure });
    const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
    await assert.rejects(
      () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
      (error) => error instanceof AnchorTransactionError && error.cause === failure
    );
  });
});

test("Contract duplicate revert after a successful pre-check is classified as already anchored", async () => {
  const fixture = await createFixture();
  const duplicateFailure = new Error("execution reverted: Already anchored");
  const client = makeClient({ failure: duplicateFailure });
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);

  await assert.rejects(
    () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
    (error) =>
      error instanceof AlreadyAnchoredError &&
      error.code === "DIGEST_ALREADY_ANCHORED" &&
      !(error instanceof AnchorTransactionError)
  );
  assert.deepEqual(client.calls.map((call) => call.method), [
    "getAnchoredAt",
    "anchorDigest",
  ]);
});

test("getAnchoredAt RPC failure prevents the anchor transaction", async () => {
  const fixture = await createFixture();
  const rpcFailure = new Error("RPC read unavailable");
  const client = makeClient();
  client.getAnchoredAt = async (digestBytes32) => {
    client.calls.push({ method: "getAnchoredAt", args: [digestBytes32] });
    throw rpcFailure;
  };
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);

  await assert.rejects(
    () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata }),
    (error) =>
      error instanceof AnchorTransactionError &&
      error.code === "WEB3_ANCHOR_FAILED" &&
      error.cause === rpcFailure
  );
  assert.deepEqual(client.calls.map((call) => call.method), ["getAnchoredAt"]);
});

test("TrustedKeyResolver validates configuration", () => {
  assert.throws(() => new TrustedKeyResolver(new Map()), /non-empty Map/);
  assert.throws(
    () => new TrustedKeyResolver(new Map([["key", ""]])),
    /non-empty strings/
  );
  assert.ok(VerificationGateError);
});
