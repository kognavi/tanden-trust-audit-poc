"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const schema = require("../schemas/evidence.schema.json");
const { LocalEcdsaProvider } = require("../lib/local-ecdsa-provider");
const {
  EvidenceProcessingService,
  EvidenceValidationError,
  EvidenceStoreWriteError,
  EvidenceLedgerWriteError,
} = require("../lib/evidence-processing-service");

function makeEvidence(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    hashAlgorithm: "SHA-256",
    evidenceId: "evd-2026-000001",
    eventType: "CONSENT_GRANTED",
    subjectId: "subject-test",
    actorId: "actor-test",
    occurredAt: "2026-08-28T00:00:00Z",
    sourceSystem: "test-suite",
    purpose: "Exercise the enforced application flow.",
    consent: { status: "granted", scope: ["audit"], version: "v1" },
    metadata: {
      environment: "test",
      containsPersonalData: false,
      notes: "Synthetic test evidence.",
    },
    ...overrides,
  };
}

function makeSignResult(overrides = {}) {
  return {
    canonicalization: "RFC 8785 JSON Canonicalization Scheme (JCS)",
    hashAlgorithm: "SHA-256",
    signatureAlgorithm: "ECDSA_SHA_256",
    digestHex: "a".repeat(64),
    signature: Buffer.from("signature"),
    signatureBase64: Buffer.from("signature").toString("base64"),
    canonicalJson: JSON.stringify(makeEvidence()),
    ...overrides,
  };
}

function makeDependencies({ sign, store, ledger } = {}) {
  const calls = [];
  const signingProvider = {
    async signEvidence(evidence, privateKeyPem) {
      calls.push("sign");
      if (sign) return sign(evidence, privateKeyPem);
      return makeSignResult();
    },
  };
  const evidenceStore = {
    async appendEvidence(input) {
      calls.push("store");
      if (store) return store(input);
      return {
        id: 41,
        evidenceId: input.evidenceId,
        version: input.version,
        digestHex: input.digestHex,
        kmsKeyId: input.kmsKeyId,
        createdAt: new Date("2026-08-28T00:01:00Z"),
      };
    },
  };
  const pgLogger = {
    async appendEvent(event) {
      calls.push("ledger");
      if (ledger) return ledger(event);
      return { eventId: "ledger-event-1", ...event };
    },
  };

  return { calls, signingProvider, evidenceStore, pgLogger };
}

function makeService(dependencies) {
  return new EvidenceProcessingService({ schema, ...dependencies });
}

test("processEvidence enforces schema -> sign -> store -> ledger and returns references", async () => {
  const dependencies = makeDependencies({
    sign(evidence) {
      assert.equal(evidence.evidenceId, "evd-2026-000001");
      return makeSignResult();
    },
    store(input) {
      assert.equal(input.version, 3);
      assert.equal(input.signature, makeSignResult().signatureBase64);
      return {
        id: 41,
        evidenceId: input.evidenceId,
        version: input.version,
        digestHex: input.digestHex,
        kmsKeyId: null,
        createdAt: new Date("2026-08-28T00:01:00Z"),
      };
    },
    ledger(event) {
      assert.equal(event.eventType, "evidence.stored");
      assert.equal(event.payload.evidenceId, "evd-2026-000001");
      assert.equal(event.payload.version, 3);
      assert.equal(event.payload.evidence, undefined);
      assert.equal(event.payload.storeReference.evidence, undefined);
      return { eventId: "ledger-event-1" };
    },
  });

  const result = await makeService(dependencies).processEvidence(makeEvidence(), { version: 3 });

  assert.deepEqual(dependencies.calls, ["sign", "store", "ledger"]);
  assert.equal(result.evidenceId, "evd-2026-000001");
  assert.equal(result.version, 3);
  assert.equal(result.digest, "a".repeat(64));
  assert.equal(result.ledgerEventId, "ledger-event-1");
  assert.equal(result.signatureMetadata.kmsKeyId, null);
  assert.equal(result.evidence, undefined);
});

test("schema failure rejects clearly without calling sign, store, or ledger", async () => {
  const dependencies = makeDependencies();

  await assert.rejects(
    () => makeService(dependencies).processEvidence(makeEvidence({ evidenceId: "invalid" }), { version: 1 }),
    (error) => {
      assert.ok(error instanceof EvidenceValidationError);
      assert.equal(error.code, "EVIDENCE_SCHEMA_VALIDATION_FAILED");
      assert.ok(error.validationErrors.length > 0);
      return true;
    }
  );
  assert.deepEqual(dependencies.calls, []);
});

test("signing failure prevents store and ledger calls", async () => {
  const dependencies = makeDependencies({
    sign() {
      throw new Error("sign unavailable");
    },
  });

  await assert.rejects(
    () => makeService(dependencies).processEvidence(makeEvidence(), { version: 1 }),
    /sign unavailable/
  );
  assert.deepEqual(dependencies.calls, ["sign"]);
});

test("store failure prevents ledger and preserves the signature for diagnostics", async () => {
  const duplicate = Object.assign(new Error("duplicate"), {
    code: "EVIDENCE_VERSION_ALREADY_EXISTS",
  });
  const dependencies = makeDependencies({
    store() {
      throw duplicate;
    },
  });

  await assert.rejects(
    () => makeService(dependencies).processEvidence(makeEvidence(), { version: 1 }),
    (error) => {
      assert.ok(error instanceof EvidenceStoreWriteError);
      assert.equal(error.code, "EVIDENCE_VERSION_ALREADY_EXISTS");
      assert.equal(error.signResult.digestHex, "a".repeat(64));
      assert.equal(error.signResult.canonicalJson, undefined);
      assert.equal(JSON.stringify(error.signResult).includes("Exercise the enforced application flow."), false);
      assert.equal(error.cause, duplicate);
      assert.equal(error.cause.code, "EVIDENCE_VERSION_ALREADY_EXISTS");
      return true;
    }
  );
  assert.deepEqual(dependencies.calls, ["sign", "store"]);
});

test("ledger failure reports stored partial state and reconciliation metadata without rollback", async () => {
  const ledgerFailure = new Error("ledger unavailable");
  let capturedError;
  const dependencies = makeDependencies({
    ledger() {
      throw ledgerFailure;
    },
  });

  await assert.rejects(
    () => makeService(dependencies).processEvidence(makeEvidence(), { version: 2 }),
    (error) => {
      capturedError = error;
      assert.ok(error instanceof EvidenceLedgerWriteError);
      assert.equal(error.code, "EVIDENCE_STORED_LEDGER_WRITE_FAILED");
      assert.equal(error.storeResult.id, 41);
      assert.equal(error.signResult.canonicalJson, undefined);
      assert.equal(error.reconciliationData.eventType, "evidence.stored");
      assert.equal(error.reconciliationData.payload.evidenceId, "evd-2026-000001");
      assert.equal(error.reconciliationData.payload.version, 2);
      assert.equal(error.reconciliationData.signature, makeSignResult().signatureBase64);
      assert.equal(error.reconciliationData.payload.evidence, undefined);
      assert.equal(error.reconciliationData.payload.canonicalJson, undefined);
      assert.equal(JSON.stringify(error.reconciliationData).includes("Exercise the enforced application flow."), false);
      assert.equal(error.cause, ledgerFailure);
      return true;
    }
  );

  const retryLogger = {
    async appendEvent(request) {
      assert.equal(request, capturedError.reconciliationData);
      return { eventId: "retried-ledger-event" };
    },
  };
  await retryLogger.appendEvent(capturedError.reconciliationData);
  assert.deepEqual(dependencies.calls, ["sign", "store", "ledger"]);
});

test("invalid versions fail closed before sign, store, or ledger", async (t) => {
  for (const version of [undefined, 0, -1, 1.5, "1"]) {
    await t.test(`rejects ${String(version)}`, async () => {
      const dependencies = makeDependencies();

      await assert.rejects(
        () => makeService(dependencies).processEvidence(makeEvidence(), { version }),
        (error) => {
          assert.equal(error.code, "INVALID_VERSION");
          return true;
        }
      );
      assert.deepEqual(dependencies.calls, []);
    });
  }
});

test("LocalEcdsaProvider satisfies the same application contract", async () => {
  const provider = new LocalEcdsaProvider();
  const { privateKey } = provider.generateEcKeyPair();
  const dependencies = makeDependencies();
  dependencies.signingProvider = provider;

  const result = await makeService(dependencies).processEvidence(makeEvidence(), {
    version: 1,
    privateKeyPem: privateKey,
  });

  assert.equal(result.signatureMetadata.signatureAlgorithm, "ECDSA_SHA_256");
  assert.equal(result.signatureMetadata.kmsKeyId, null);
  assert.deepEqual(dependencies.calls, ["store", "ledger"]);
});

test("mock KMS provider satisfies the contract and propagates physical key metadata", async () => {
  const kmsKeyId = "arn:aws:kms:ap-northeast-1:123456789012:key/test-key";
  const dependencies = makeDependencies({
    sign(_evidence, privateKeyPem) {
      assert.equal(privateKeyPem, undefined);
      return makeSignResult({ kmsKeyId, signedAt: "2026-08-28T00:00:30Z" });
    },
  });

  const result = await makeService(dependencies).processEvidence(makeEvidence(), { version: 1 });

  assert.equal(result.signatureMetadata.kmsKeyId, kmsKeyId);
  assert.equal(result.storeReference.kmsKeyId, kmsKeyId);
  assert.deepEqual(dependencies.calls, ["sign", "store", "ledger"]);
});
