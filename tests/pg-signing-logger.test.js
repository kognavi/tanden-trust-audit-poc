"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { PgSigningLogger, GENESIS_HASH } = require("../lib/pg-signing-logger");

/**
 * In-memory fake standing in for `pg.Pool`. It understands only the
 * specific SQL statements PgSigningLogger issues, matched by pattern.
 * This lets the full appendEvent/verifyChainIntegrity logic run against
 * real SQL text (catching typos in the queries themselves) without a
 * real PostgreSQL instance.
 */
class FakeSigningEventsTable {
  constructor() {
    this.rows = [];
    this.nextSequence = 1;
    this.schemaInitialized = false;
    this.revoked = false;
  }
}

class FakeClient {
  constructor(table, callLog) {
    this._table = table;
    this._callLog = callLog;
  }

  async query(text, params = []) {
    const sql = text.trim();
    this._callLog.push(sql.split("\n")[0].trim());

    if (/^BEGIN/i.test(sql)) return { rows: [] };
    if (/^COMMIT/i.test(sql)) return { rows: [] };
    if (/^ROLLBACK/i.test(sql)) return { rows: [] };

    if (/^SELECT pg_advisory_xact_lock/i.test(sql)) {
      return { rows: [] };
    }

    if (/^CREATE TABLE IF NOT EXISTS signing_events/i.test(sql)) {
      this._table.schemaInitialized = true;
      return { rows: [] };
    }

    if (/^REVOKE UPDATE, DELETE ON signing_events FROM PUBLIC/i.test(sql)) {
      this._table.revoked = true;
      return { rows: [] };
    }

    if (/^SELECT row_hash FROM signing_events/i.test(sql)) {
      const last = this._table.rows[this._table.rows.length - 1];
      return { rows: last ? [{ row_hash: last.row_hash }] : [] };
    }

    if (/^INSERT INTO signing_events/i.test(sql)) {
      if (this._table.forceInsertError) {
        throw new Error("simulated INSERT failure");
      }
      const [eventId, eventType, payload, signature, previousHash, rowHash] = params;
      const sequence = this._table.nextSequence++;
      const created_at = new Date();
      this._table.rows.push({
        sequence,
        event_id: eventId,
        event_type: eventType,
        payload,
        signature,
        previous_hash: previousHash,
        row_hash: rowHash,
        created_at,
      });
      return { rows: [{ sequence, created_at }] };
    }

    if (/ORDER BY sequence ASC/i.test(sql)) {
      return { rows: this._table.rows.map((row) => ({ ...row })) };
    }

    if (/ORDER BY sequence DESC\s+LIMIT 1/i.test(sql)) {
      const last = this._table.rows[this._table.rows.length - 1];
      return { rows: last ? [{ ...last }] : [] };
    }

    throw new Error(`FakeClient: unrecognized query: ${sql}`);
  }

  release() {
    /* no-op */
  }
}

class FakePool {
  constructor() {
    this.table = new FakeSigningEventsTable();
    this.callLog = [];
  }

  async connect() {
    return new FakeClient(this.table, this.callLog);
  }

  async query(text, params) {
    const client = new FakeClient(this.table, this.callLog);
    return client.query(text, params);
  }
}

function makeLogger(pool = new FakePool()) {
  return { logger: new PgSigningLogger({ pool }), pool };
}

test("constructor throws without a valid pool", () => {
  assert.throws(() => new PgSigningLogger({}), /requires a `pool`/);
  assert.throws(
    () => new PgSigningLogger({ pool: { query: () => {} } }),
    /requires a `pool`/
  );
});

test("initializeSchema creates the table and revokes UPDATE/DELETE", async () => {
  const { logger, pool } = makeLogger();
  await logger.initializeSchema();
  assert.equal(pool.table.schemaInitialized, true);
  assert.equal(pool.table.revoked, true);
});

test("computeRowHash is deterministic and sensitive to every field", async () => {
  const base = {
    eventId: "11111111-1111-1111-1111-111111111111",
    eventType: "evidence.signed",
    payload: { foo: "bar" },
    signature: "sig-abc",
    previousHash: GENESIS_HASH,
  };

  const hash1 = await PgSigningLogger.computeRowHash(base);
  const hash2 = await PgSigningLogger.computeRowHash({ ...base });
  assert.equal(hash1, hash2, "same input must produce same hash");

  for (const field of ["eventId", "eventType", "signature", "previousHash"]) {
    const mutated = { ...base, [field]: `${base[field]}-tampered` };
    const mutatedHash = await PgSigningLogger.computeRowHash(mutated);
    assert.notEqual(mutatedHash, hash1, `changing ${field} must change the hash`);
  }

  const mutatedPayload = { ...base, payload: { foo: "TAMPERED" } };
  assert.notEqual(
    await PgSigningLogger.computeRowHash(mutatedPayload),
    hash1,
    "changing payload must change the hash"
  );
});

test("appendEvent validates required fields", async () => {
  const { logger } = makeLogger();

  await assert.rejects(
    logger.appendEvent({ payload: {}, signature: "sig" }),
    /non-empty `eventType`/
  );
  await assert.rejects(
    logger.appendEvent({ eventType: "x", signature: "sig" }),
    /requires a `payload`/
  );
  await assert.rejects(
    logger.appendEvent({ eventType: "x", payload: {} }),
    /non-empty `signature`/
  );
});

test("first appendEvent chains to GENESIS_HASH", async () => {
  const { logger } = makeLogger();

  const result = await logger.appendEvent({
    eventType: "evidence.signed",
    payload: { doc: "A" },
    signature: "sig-A",
  });

  assert.equal(result.sequence, 1);
  assert.equal(result.previousHash, GENESIS_HASH);
  assert.equal(
    result.rowHash,
    await PgSigningLogger.computeRowHash({
      eventId: result.eventId,
      eventType: "evidence.signed",
      payload: { doc: "A" },
      signature: "sig-A",
      previousHash: GENESIS_HASH,
    })
  );
});

test("second appendEvent chains to the first event's rowHash", async () => {
  const { logger } = makeLogger();

  const first = await logger.appendEvent({
    eventType: "evidence.signed",
    payload: { doc: "A" },
    signature: "sig-A",
  });
  const second = await logger.appendEvent({
    eventType: "evidence.signed",
    payload: { doc: "B" },
    signature: "sig-B",
  });

  assert.equal(second.sequence, 2);
  assert.equal(second.previousHash, first.rowHash);
  assert.notEqual(second.rowHash, first.rowHash);
});

test("appendEvent acquires the advisory lock before reading the last row", async () => {
  const { logger, pool } = makeLogger();
  await logger.appendEvent({
    eventType: "evidence.signed",
    payload: { doc: "A" },
    signature: "sig-A",
  });

  const lockIndex = pool.callLog.findIndex((entry) =>
    /pg_advisory_xact_lock/i.test(entry)
  );
  const readLastRowIndex = pool.callLog.findIndex((entry) =>
    /SELECT row_hash FROM signing_events/i.test(entry)
  );

  assert.ok(lockIndex !== -1, "advisory lock query must be issued");
  assert.ok(readLastRowIndex !== -1, "last-row read query must be issued");
  assert.ok(
    lockIndex < readLastRowIndex,
    "advisory lock must be acquired BEFORE reading the last row, to avoid a race between concurrent writers"
  );
});

test("appendEvent rolls back the transaction on INSERT failure", async () => {
  const { logger, pool } = makeLogger();
  pool.table.forceInsertError = true;

  await assert.rejects(
    logger.appendEvent({
      eventType: "evidence.signed",
      payload: { doc: "A" },
      signature: "sig-A",
    }),
    /simulated INSERT failure/
  );

  assert.equal(pool.table.rows.length, 0, "no row should be committed on failure");
  assert.ok(
    pool.callLog.includes("ROLLBACK"),
    "ROLLBACK must be issued when the insert fails"
  );
});

test("verifyChainIntegrity returns valid:true for an empty ledger", async () => {
  const { logger } = makeLogger();
  const result = await logger.verifyChainIntegrity();
  assert.deepEqual(result, {
    valid: true,
    totalEvents: 0,
    lastHash: GENESIS_HASH,
  });
});

test("verifyChainIntegrity returns valid:true for an untampered chain", async () => {
  const { logger } = makeLogger();
  await logger.appendEvent({ eventType: "t1", payload: { n: 1 }, signature: "s1" });
  await logger.appendEvent({ eventType: "t2", payload: { n: 2 }, signature: "s2" });
  const last = await logger.appendEvent({ eventType: "t3", payload: { n: 3 }, signature: "s3" });

  const result = await logger.verifyChainIntegrity();
  assert.equal(result.valid, true);
  assert.equal(result.totalEvents, 3);
  assert.equal(result.lastHash, last.rowHash);
});

test("verifyChainIntegrity detects row_hash tampering (payload modified in place)", async () => {
  const { logger, pool } = makeLogger();
  await logger.appendEvent({ eventType: "t1", payload: { n: 1 }, signature: "s1" });
  await logger.appendEvent({ eventType: "t2", payload: { n: 2 }, signature: "s2" });

  // Simulate an attacker directly editing row content in the database,
  // bypassing the application layer entirely.
  pool.table.rows[0].payload = { n: 999 };

  const result = await logger.verifyChainIntegrity();
  assert.equal(result.valid, false);
  assert.equal(result.failedAtSequence, 1);
  assert.match(result.reason, /row_hash mismatch/);
});

test("verifyChainIntegrity detects a broken chain (row deleted)", async () => {
  const { logger, pool } = makeLogger();
  await logger.appendEvent({ eventType: "t1", payload: { n: 1 }, signature: "s1" });
  await logger.appendEvent({ eventType: "t2", payload: { n: 2 }, signature: "s2" });
  await logger.appendEvent({ eventType: "t3", payload: { n: 3 }, signature: "s3" });

  // Simulate deletion of the middle row (bypassing the REVOKE guard,
  // as a table owner/superuser could).
  pool.table.rows.splice(1, 1);

  const result = await logger.verifyChainIntegrity();
  assert.equal(result.valid, false);
  // The row now at position 2 (originally sequence 3) still points to
  // the deleted row's hash, so the break surfaces at sequence 3.
  assert.equal(result.failedAtSequence, 3);
  assert.match(result.reason, /previous_hash mismatch/);
});

test("getLatestEvent returns null for an empty ledger", async () => {
  const { logger } = makeLogger();
  assert.equal(await logger.getLatestEvent(), null);
});

test("getLatestEvent returns the most recently appended event", async () => {
  const { logger } = makeLogger();
  await logger.appendEvent({ eventType: "t1", payload: { n: 1 }, signature: "s1" });
  const second = await logger.appendEvent({ eventType: "t2", payload: { n: 2 }, signature: "s2" });

  const latest = await logger.getLatestEvent();
  assert.equal(latest.sequence, second.sequence);
  assert.equal(latest.eventType, "t2");
  assert.deepEqual(latest.payload, { n: 2 });
  assert.equal(latest.rowHash, second.rowHash);
});