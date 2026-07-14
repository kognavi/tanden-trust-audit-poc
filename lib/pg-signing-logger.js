"use strict";

const crypto = require("node:crypto");
const { canonicalizeValue } = require("./canonicalize-loader");

/**
 * Sentinel previous_hash value for the first row in the ledger.
 * A 64-character hex string of zeros, matching SHA-256 output length,
 * so that GENESIS_HASH is visually and structurally consistent with
 * real row_hash values.
 */
const GENESIS_HASH = "0".repeat(64);

/**
 * Arbitrary but fixed advisory lock key scoped to the signing_events
 * ledger. Any int64 works; this constant just needs to be stable and
 * not collide with other advisory locks used elsewhere in the system.
 * See docs/adr/0004-signing-event-ledger.md for rationale.
 */
const ADVISORY_LOCK_KEY = 741_852_963;

/**
 * PgSigningLogger implements an append-only, hash-chained audit ledger
 * backed by PostgreSQL.
 *
 * Each event is linked to the previous event via `previousHash` /
 * `rowHash`, forming a tamper-evident chain: deleting or modifying any
 * row breaks the chain for the row(s) that follow it, and modifying a
 * row's own content changes its `rowHash`, both of which are detected
 * by `verifyChainIntegrity()`.
 *
 * NOTE: `sequence` is intentionally excluded from the hash computation.
 * See docs/adr/0004-signing-event-ledger.md for why (PostgreSQL BIGSERIAL
 * values are not transactional and can develop benign gaps).
 */
class PgSigningLogger {
  /**
   * @param {object} options
   * @param {import("pg").Pool} options.pool - a pg.Pool instance.
   */
  constructor({ pool } = {}) {
    if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") {
      throw new Error(
        "PgSigningLogger requires a `pool` implementing pg.Pool's query() and connect()."
      );
    }
    this._pool = pool;
  }

  /**
   * Creates the signing_events table and applies the REVOKE guard,
   * if they do not already exist. Idempotent; safe to call on every
   * process startup.
   */
  async initializeSchema() {
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS signing_events (
        sequence      BIGSERIAL PRIMARY KEY,
        event_id      UUID NOT NULL UNIQUE,
        event_type    TEXT NOT NULL,
        payload       JSONB NOT NULL,
        signature     TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        row_hash      TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Defense-in-depth: even the application's own DB role should not be
    // able to mutate or delete committed events. See ADR 0004 for the
    // residual-risk discussion (this does not stop a table owner/superuser).
    await this._pool.query("REVOKE UPDATE, DELETE ON signing_events FROM PUBLIC");
  }

  /**
   * Computes the deterministic row_hash for a signing event.
   * `sequence` is NOT part of the hash input — see module-level comment.
   *
   * @param {object} fields
   * @param {string} fields.eventId
   * @param {string} fields.eventType
   * @param {*} fields.payload
   * @param {string} fields.signature
   * @param {string} fields.previousHash
   * @returns {string} lowercase hex SHA-256 digest
   */
  static async computeRowHash({ eventId, eventType, payload, signature, previousHash }) {
  const canonical = await canonicalizeValue({
    eventId,
    eventType,
    payload,
    signature,
    previousHash,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

  /**
   * Appends a new signing event to the ledger, chaining it to the
   * current last row (or GENESIS_HASH if the ledger is empty).
   *
   * Concurrency-safe: uses a transaction-scoped advisory lock so that
   * concurrent callers (across processes/connections) cannot both read
   * the same "last row" and produce two rows chained to the same parent.
   *
   * @param {object} event
   * @param {string} event.eventType
   * @param {*} event.payload
   * @param {string} event.signature
   * @returns {Promise<{sequence:number, eventId:string, eventType:string, previousHash:string, rowHash:string, createdAt:Date}>}
   */
  async appendEvent({ eventType, payload, signature } = {}) {
    if (typeof eventType !== "string" || eventType.length === 0) {
      throw new Error("PgSigningLogger.appendEvent requires a non-empty `eventType` string.");
    }
    if (payload === undefined) {
      throw new Error("PgSigningLogger.appendEvent requires a `payload`.");
    }
    if (typeof signature !== "string" || signature.length === 0) {
      throw new Error("PgSigningLogger.appendEvent requires a non-empty `signature` string.");
    }

    const client = await this._pool.connect();
    try {
      await client.query("BEGIN");

      // Serialize all appends so that "the last row" read below is
      // consistent even under concurrent writers.
      await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);

      const previousHashResult = await client.query(
        "SELECT row_hash FROM signing_events ORDER BY sequence DESC LIMIT 1"
      );
      const previousHash =
        previousHashResult.rows.length > 0
          ? previousHashResult.rows[0].row_hash
          : GENESIS_HASH;

      const eventId = crypto.randomUUID();

      const rowHash = await PgSigningLogger.computeRowHash({
        eventId,
        eventType,
        payload,
        signature,
        previousHash,
      });

      const insertResult = await client.query(
        `INSERT INTO signing_events
           (event_id, event_type, payload, signature, previous_hash, row_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING sequence, created_at`,
        [eventId, eventType, payload, signature, previousHash, rowHash]
      );

      await client.query("COMMIT");

      const row = insertResult.rows[0];
      return {
        sequence: Number(row.sequence),
        eventId,
        eventType,
        previousHash,
        rowHash,
        createdAt: row.created_at,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reads the full ledger in sequence order and re-verifies the hash
   * chain from scratch: each row's stored previous_hash must match the
   * prior row's row_hash, and each row's row_hash must match a fresh
   * recomputation from its own fields (detects field tampering).
   *
   * Sequence gaps are NOT treated as failures (see ADR 0004); only a
   * broken hash chain or a mismatched row_hash is reported as invalid.
   *
   * @returns {Promise<{valid:true, totalEvents:number, lastHash:string} | {valid:false, reason:string, failedAtSequence:number}>}
   */
  async verifyChainIntegrity() {
    const result = await this._pool.query(
      `SELECT sequence, event_id, event_type, payload, signature, previous_hash, row_hash
         FROM signing_events
        ORDER BY sequence ASC`
    );

    let expectedPreviousHash = GENESIS_HASH;

    for (const row of result.rows) {
      const sequence = Number(row.sequence);

      if (row.previous_hash !== expectedPreviousHash) {
        return {
          valid: false,
          reason: `previous_hash mismatch at sequence ${sequence}: expected ${expectedPreviousHash}, found ${row.previous_hash}. The chain is broken (a row may have been deleted or reordered).`,
          failedAtSequence: sequence,
        };
      }

      const recomputedHash = await PgSigningLogger.computeRowHash({
        eventId: row.event_id,
        eventType: row.event_type,
        payload: row.payload,
        signature: row.signature,
        previousHash: row.previous_hash,
      });

      if (recomputedHash !== row.row_hash) {
        return {
          valid: false,
          reason: `row_hash mismatch at sequence ${sequence}: stored hash does not match recomputed hash (tampering detected in this row's content).`,
          failedAtSequence: sequence,
        };
      }

      expectedPreviousHash = row.row_hash;
    }

    return {
      valid: true,
      totalEvents: result.rows.length,
      lastHash: expectedPreviousHash,
    };
  }

  /**
   * @returns {Promise<object|null>} the most recently appended event, or null if the ledger is empty.
   */
  async getLatestEvent() {
    const result = await this._pool.query(
      `SELECT sequence, event_id, event_type, payload, signature, previous_hash, row_hash, created_at
         FROM signing_events
        ORDER BY sequence DESC
        LIMIT 1`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      sequence: Number(row.sequence),
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      signature: row.signature,
      previousHash: row.previous_hash,
      rowHash: row.row_hash,
      createdAt: row.created_at,
    };
  }
}

module.exports = { PgSigningLogger, GENESIS_HASH };