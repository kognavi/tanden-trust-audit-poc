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
  InternalLedgerVerificationError,
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
const ledgerEventId = "11111111-1111-4111-8111-111111111111";
const ledgerRowHash = "c".repeat(64);
const transactionHash = `0x${"d".repeat(64)}`;
const provenance = {
  provider: "ethereum",
  network: "hardhat",
  chainId: 31337,
  contractAddress: `0x${"1".repeat(40)}`,
};

function makeClient({ anchoredAt = 0n, failure, readFailure, transactionResult, customProvenance } = {}) {
  const calls = [];
  return {
    calls,
    provenance: customProvenance ?? provenance,
    async getAnchoredAt(digestBytes32) {
      calls.push({ method: "getAnchoredAt", args: [digestBytes32] });
      if (readFailure) throw readFailure;
      return anchoredAt;
    },
    async anchorDigest(...args) {
      calls.push({ method: "anchorDigest", args });
      if (failure) throw failure;
      return transactionResult ?? { transactionHash, blockNumber: 123 };
    },
  };
}

function makeLedgerVerifier(result = { confirmed: true, eventId: ledgerEventId, rowHash: ledgerRowHash }) {
  const calls = [];
  return {
    calls,
    async verifyRecordedEvidence(input) {
      calls.push(input);
      if (result instanceof Error) throw result;
      return result;
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
  const metadata = await signSidecarMetadata(unsignedMetadata, keyPair.privateKey, provider);
  return { provider, keyPair, metadata, digest };
}

function makeService(client, trustedEntries, internalLedgerVerifier = makeLedgerVerifier()) {
  return new VerifiedAnchorService({
    anchorClient: client,
    trustedKeyResolver: new TrustedKeyResolver(new Map(trustedEntries)),
    internalLedgerVerifier,
  });
}

test("verified and internally recorded Evidence anchors only its recomputed digest", async () => {
  const fixture = await createFixture();
  const client = makeClient();
  const ledger = makeLedgerVerifier();
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]], ledger);
  const result = await service.anchorVerifiedEvidence({
    evidence,
    metadata: fixture.metadata,
    ledgerEventId,
    callerSuppliedPii: "not forwarded",
  });
  assert.equal(result.digestHex, fixture.digest);
  assert.deepEqual(ledger.calls, [{ ledgerEventId, evidenceId: evidence.evidenceId, digestHex: fixture.digest }]);
  assert.deepEqual(client.calls, [
    { method: "getAnchoredAt", args: [`0x${fixture.digest}`] },
    { method: "anchorDigest", args: [`0x${fixture.digest}`] },
  ]);
  assert.deepEqual(result.anchorVerification, {
    schemaVersion: "tanden.external-anchor.v1",
    evidenceId: evidence.evidenceId,
    digestHex: fixture.digest,
    keyId: fixture.metadata.keyId,
    internalLedger: { eventId: ledgerEventId, rowHash: ledgerRowHash },
    externalLedger: {
      provider: "ethereum",
      network: "hardhat",
      chainId: "31337",
      contractAddress: provenance.contractAddress,
      transactionHash,
      blockNumber: "123",
    },
  });
  assert.equal(JSON.stringify(client.calls).includes(evidence.evidenceId), false);
  assert.equal(JSON.stringify(result.anchorVerification).includes("signature"), false);
});

test("caller-forged booleans and arbitrary hashes are rejected before trusted gates", async () => {
  const fixture = await createFixture();
  const client = makeClient();
  const ledger = makeLedgerVerifier();
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]], ledger);
  await assert.rejects(
    () => service.anchorVerifiedEvidence({ valid: true, signatureValid: true, digestHex: "b".repeat(64) }),
    (error) => error.code === "INVALID_SIDECAR_METADATA"
  );
  assert.deepEqual(ledger.calls, []);
  assert.deepEqual(client.calls, []);
});

test("valid request fields cannot override constructor-bound trust dependencies", async () => {
  const fixture = await createFixture();
  const client = makeClient();
  const ledger = makeLedgerVerifier();
  let attackerCalled = false;
  const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]], ledger);
  await service.anchorVerifiedEvidence({
    evidence,
    metadata: fixture.metadata,
    ledgerEventId,
    trustedKeyResolver: { resolvePublicKey: () => { attackerCalled = true; } },
    internalLedgerVerifier: { verifyRecordedEvidence: () => { attackerCalled = true; } },
    anchorClient: { anchorDigest: () => { attackerCalled = true; } },
    provenance: { provider: "attacker" },
  });
  assert.equal(attackerCalled, false);
  assert.equal(ledger.calls.length, 1);
  assert.equal(client.calls.length, 2);
});

test("unknown or wrong keys, caller overrides, and tampering fail before ledger/external calls", async (t) => {
  const trusted = new LocalEcdsaProvider().generateEcKeyPair();
  const unknown = await createFixture({ keyId: "unknown-key" });
  const attacker = new LocalEcdsaProvider().generateEcKeyPair();
  const wrongKey = await createFixture({ signer: attacker });
  const valid = await createFixture();
  const cases = [
    ["unknown key", [["local-dev-key-001", trusted.publicKey]], { evidence, metadata: unknown.metadata, ledgerEventId }, "UNTRUSTED_SIGNING_KEY"],
    ["wrong key", [[wrongKey.metadata.keyId, trusted.publicKey]], { evidence, metadata: wrongKey.metadata, ledgerEventId }, "VERIFICATION_NOT_APPROVED"],
    ["caller key override", [[wrongKey.metadata.keyId, trusted.publicKey]], { evidence, metadata: wrongKey.metadata, ledgerEventId, publicKeyPem: attacker.publicKey }, "VERIFICATION_NOT_APPROVED"],
    ["Evidence tamper", [[valid.metadata.keyId, valid.keyPair.publicKey]], { evidence: { ...evidence, action: "consent.revoked" }, metadata: valid.metadata, ledgerEventId }, "VERIFICATION_NOT_APPROVED"],
    ["metadata tamper", [[valid.metadata.keyId, valid.keyPair.publicKey]], { evidence, metadata: { ...valid.metadata, evidenceKey: "evidence/tampered.json" }, ledgerEventId }, "VERIFICATION_NOT_APPROVED"],
    ["signature tamper", [[valid.metadata.keyId, valid.keyPair.publicKey]], { evidence, metadata: { ...valid.metadata, signature: "invalid-signature" }, ledgerEventId }, "VERIFICATION_NOT_APPROVED"],
  ];
  for (const [name, entries, input, code] of cases) {
    await t.test(name, async () => {
      const client = makeClient();
      const ledger = makeLedgerVerifier();
      await assert.rejects(() => makeService(client, entries, ledger).anchorVerifiedEvidence(input), (error) => error.code === code);
      assert.deepEqual(ledger.calls, []);
      assert.deepEqual(client.calls, []);
    });
  }
});

test("zero digest and missing ledger ID fail before external calls", async (t) => {
  const fixture = await createFixture();
  const zeroMetadata = await signSidecarMetadata(
    { ...fixture.metadata, digest: "0".repeat(64), signature: "placeholder" },
    fixture.keyPair.privateKey,
    fixture.provider
  );
  for (const [name, metadata, eventId, code] of [
    ["zero digest", zeroMetadata, ledgerEventId, "VERIFICATION_NOT_APPROVED"],
    ["missing ledger ID", fixture.metadata, undefined, "INVALID_LEDGER_EVENT_ID"],
  ]) {
    await t.test(name, async () => {
      const client = makeClient();
      const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]]);
      await assert.rejects(() => service.anchorVerifiedEvidence({ evidence, metadata, ledgerEventId: eventId }), (error) => error.code === code);
      assert.deepEqual(client.calls, []);
    });
  }
});

test("internal ledger rejection, malformed confirmation, and failure prevent external calls", async (t) => {
  const fixture = await createFixture();
  const cases = [
    ["rejected", { confirmed: false, reason: "DIGEST_MISMATCH" }, "DIGEST_MISMATCH"],
    ["malformed", { confirmed: true, eventId: ledgerEventId, rowHash: "bad" }, "MALFORMED_LEDGER_CONFIRMATION"],
    ["failure", new Error("database unavailable"), "LEDGER_VERIFIER_ERROR"],
  ];
  for (const [name, result, reason] of cases) {
    await t.test(name, async () => {
      const client = makeClient();
      const service = makeService(client, [[fixture.metadata.keyId, fixture.keyPair.publicKey]], makeLedgerVerifier(result));
      await assert.rejects(
        () => service.anchorVerifiedEvidence({ evidence, metadata: fixture.metadata, ledgerEventId }),
        (error) => error instanceof InternalLedgerVerificationError && error.reason === reason
      );
      assert.deepEqual(client.calls, []);
    });
  }
});

test("duplicate, RPC, transaction, and invalid receipt semantics are explicit", async (t) => {
  const fixture = await createFixture();
  const entries = [[fixture.metadata.keyId, fixture.keyPair.publicKey]];
  await t.test("already anchored", async () => {
    const client = makeClient({ anchoredAt: 123n });
    await assert.rejects(
      () => makeService(client, entries).anchorVerifiedEvidence({ evidence, metadata: fixture.metadata, ledgerEventId }),
      (error) => error instanceof AlreadyAnchoredError && error.anchoredAt === "123"
    );
  });
  await t.test("duplicate race", async () => {
    const client = makeClient({ failure: new Error("execution reverted: Already anchored") });
    await assert.rejects(
      () => makeService(client, entries).anchorVerifiedEvidence({ evidence, metadata: fixture.metadata, ledgerEventId }),
      (error) => error instanceof AlreadyAnchoredError && error.anchoredAt === null
    );
  });
  for (const [name, client, operation] of [
    ["RPC read", makeClient({ readFailure: new Error("RPC read unavailable") }), "read-anchor-state"],
    ["transaction", makeClient({ failure: new Error("RPC unavailable") }), "submit-anchor-transaction"],
    ["invalid receipt", makeClient({ transactionResult: { transactionHash: "0xbad", blockNumber: 1 } }), "validate-transaction-result"],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(
        () => makeService(client, entries).anchorVerifiedEvidence({ evidence, metadata: fixture.metadata, ledgerEventId }),
        (error) => error instanceof AnchorTransactionError && error.operation === operation
      );
    });
  }
  await t.test("malformed anchor state", async () => {
    const client = makeClient({ anchoredAt: "not-an-integer" });
    await assert.rejects(
      () => makeService(client, entries).anchorVerifiedEvidence({ evidence, metadata: fixture.metadata, ledgerEventId }),
      (error) => error.code === "INVALID_ANCHOR_STATE"
    );
    assert.deepEqual(client.calls.map(({ method }) => method), ["getAnchoredAt"]);
  });
});

test("constructor-bound dependencies and provenance are validated", async () => {
  const fixture = await createFixture();
  const entries = [[fixture.metadata.keyId, fixture.keyPair.publicKey]];
  assert.throws(() => new TrustedKeyResolver(new Map()), /non-empty Map/);
  assert.ok(VerificationGateError);
  assert.throws(() => makeService(makeClient({ customProvenance: { ...provenance, chainId: 0 } }), entries), /positive integer/);
  assert.throws(() => makeService(makeClient({ customProvenance: { ...provenance, contractAddress: "0xbad" } }), entries), /20-byte hex/);
  assert.throws(
    () => new VerifiedAnchorService({ anchorClient: makeClient(), trustedKeyResolver: new TrustedKeyResolver(new Map(entries)) }),
    /internalLedgerVerifier/
  );
});
