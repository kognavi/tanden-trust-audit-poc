"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PgEvidenceStore,
  EvidenceStoreError,
} = require("../lib/pg-evidence-store");

function makeValidInput(overrides = {}) {
  return {
    evidenceId: "consent-123",
    version: 1,
    evidence: {
      evidenceId: "consent-123",
      status: "approved",
    },
    canonicalization: "RFC8785",
    hashAlgorithm: "SHA-256",
    digestHex: "a".repeat(64),
    signature: "base64-signature",
    signingAlgorithm: "ECDSA_SHA_256",
    kmsKeyId: "arn:aws:kms:ap-northeast-1:123456789012:key/example",
    ...overrides,
  };
}

function makeFakePool(handler) {
  const calls = [];

  return {
    calls,

    async query(sql, params = []) {
      calls.push({ sql, params });

      if (handler) {
        return handler(sql, params);
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

test("constructor throws when pool is missing", () => {
  assert.throws(
    () => new PgEvidenceStore(),
    (err) => {
      assert.ok(err instanceof EvidenceStoreError);
      assert.equal(err.code, "INVALID_POOL");
      return true;
    }
  );
});

test("initializeSchema creates append-only evidence_versions table", async () => {
  const pool = makeFakePool();
  const store = new PgEvidenceStore({ pool });

  await store.initializeSchema();

  assert.equal(pool.calls.length, 1);

  const sql = pool.calls[0].sql;

  assert.match(sql, /CREATE TABLE IF NOT EXISTS evidence_versions/i);
  assert.match(sql, /UNIQUE\s*\(\s*evidence_id\s*,\s*version\s*\)/i);

  // v2は更新・削除前提にしない
  assert.doesNotMatch(sql, /updated_at/i);
});

test("appendEvidence inserts a new immutable evidence version", async () => {
  const createdAt = new Date("2026-08-25T00:00:00.000Z");

  const pool = makeFakePool((sql, params) => {
    assert.match(sql, /INSERT INTO evidence_versions/i);

    assert.deepEqual(params, [
      "consent-123",
      1,
      JSON.stringify({
        evidenceId: "consent-123",
        status: "approved",
      }),
      "RFC8785",
      "SHA-256",
      "a".repeat(64),
      "base64-signature",
      "ECDSA_SHA_256",
      "arn:aws:kms:ap-northeast-1:123456789012:key/example",
    ]);

    return {
      rows: [
        {
          id: "1",
          evidence_id: "consent-123",
          version: "1",
          digest_hex: "a".repeat(64),
          kms_key_id:
            "arn:aws:kms:ap-northeast-1:123456789012:key/example",
          created_at: createdAt,
        },
      ],
    };
  });

  const store = new PgEvidenceStore({ pool });

  const result = await store.appendEvidence(makeValidInput());

  assert.deepEqual(result, {
    id: 1,
    evidenceId: "consent-123",
    version: 1,
    digestHex: "a".repeat(64),
    kmsKeyId:
      "arn:aws:kms:ap-northeast-1:123456789012:key/example",
    createdAt,
  });
});

test("appendEvidence maps PostgreSQL unique violation to EVIDENCE_VERSION_ALREADY_EXISTS", async () => {
  const pool = makeFakePool(() => {
    const err = new Error("duplicate key");
    err.code = "23505";
    throw err;
  });

  const store = new PgEvidenceStore({ pool });

  await assert.rejects(
    () => store.appendEvidence(makeValidInput()),
    (err) => {
      assert.ok(err instanceof EvidenceStoreError);
      assert.equal(err.code, "EVIDENCE_VERSION_ALREADY_EXISTS");
      assert.ok(err.cause);
      assert.equal(err.cause.code, "23505");
      return true;
    }
  );
});

test("getEvidenceVersion returns the requested evidence version", async () => {
  const createdAt = new Date("2026-08-25T00:00:00.000Z");

  const pool = makeFakePool((sql, params) => {
    assert.match(sql, /FROM evidence_versions/i);
    assert.deepEqual(params, ["consent-123", 1]);

    return {
      rows: [
        {
          id: "7",
          evidence_id: "consent-123",
          version: "1",
          evidence: {
            evidenceId: "consent-123",
            status: "approved",
          },
          canonicalization: "RFC8785",
          hash_algorithm: "SHA-256",
          digest_hex: "b".repeat(64),
          signature: "stored-signature",
          signing_algorithm: "ECDSA_SHA_256",
          kms_key_id:
            "arn:aws:kms:ap-northeast-1:123456789012:key/example",
          created_at: createdAt,
        },
      ],
    };
  });

  const store = new PgEvidenceStore({ pool });

  const result = await store.getEvidenceVersion("consent-123", 1);

  assert.deepEqual(result, {
    id: 7,
    evidenceId: "consent-123",
    version: 1,
    evidence: {
      evidenceId: "consent-123",
      status: "approved",
    },
    canonicalization: "RFC8785",
    hashAlgorithm: "SHA-256",
    digestHex: "b".repeat(64),
    signature: "stored-signature",
    signingAlgorithm: "ECDSA_SHA_256",
    kmsKeyId:
      "arn:aws:kms:ap-northeast-1:123456789012:key/example",
    createdAt,
  });
});

test("getEvidenceVersion returns null when version does not exist", async () => {
  const pool = makeFakePool(() => ({
    rows: [],
  }));

  const store = new PgEvidenceStore({ pool });

  const result = await store.getEvidenceVersion("consent-123", 999);

  assert.equal(result, null);
});

test("exists returns true when evidence version exists", async () => {
  const pool = makeFakePool(() => ({
    rows: [{ "?column?": 1 }],
  }));

  const store = new PgEvidenceStore({ pool });

  const result = await store.exists("consent-123", 1);

  assert.equal(result, true);
});

test("exists returns false when evidence version does not exist", async () => {
  const pool = makeFakePool(() => ({
    rows: [],
  }));

  const store = new PgEvidenceStore({ pool });

  const result = await store.exists("consent-123", 1);

  assert.equal(result, false);
});

test("appendEvidence rejects invalid evidenceId", async () => {
  const pool = makeFakePool();
  const store = new PgEvidenceStore({ pool });

  await assert.rejects(
    () =>
      store.appendEvidence(
        makeValidInput({
          evidenceId: "",
        })
      ),
    (err) => {
      assert.equal(err.code, "INVALID_EVIDENCE_ID");
      return true;
    }
  );

  assert.equal(pool.calls.length, 0);
});

test("appendEvidence rejects invalid version", async () => {
  const pool = makeFakePool();
  const store = new PgEvidenceStore({ pool });

  await assert.rejects(
    () =>
      store.appendEvidence(
        makeValidInput({
          version: 0,
        })
      ),
    (err) => {
      assert.equal(err.code, "INVALID_VERSION");
      return true;
    }
  );

  assert.equal(pool.calls.length, 0);
});

test("appendEvidence rejects invalid digestHex", async () => {
  const pool = makeFakePool();
  const store = new PgEvidenceStore({ pool });

  await assert.rejects(
    () =>
      store.appendEvidence(
        makeValidInput({
          digestHex: "not-a-valid-sha256",
        })
      ),
    (err) => {
      assert.equal(err.code, "INVALID_DIGEST");
      return true;
    }
  );

  assert.equal(pool.calls.length, 0);
});