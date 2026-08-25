"use strict";

const POSTGRES_UNIQUE_VIOLATION = "23505";

class EvidenceStoreError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "EvidenceStoreError";
    this.code = code;
  }
}

class PgEvidenceStore {
  constructor({ pool } = {}) {
    if (!pool || typeof pool.query !== "function") {
      throw new EvidenceStoreError(
        "INVALID_POOL",
        "PgEvidenceStore requires a pool implementing query()."
      );
    }

    this._pool = pool;
  }

  async initializeSchema() {
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS evidence_versions (
        id                BIGSERIAL PRIMARY KEY,
        evidence_id       TEXT NOT NULL,
        version           BIGINT NOT NULL CHECK (version >= 1),
        evidence          JSONB NOT NULL,
        canonicalization  TEXT NOT NULL,
        hash_algorithm    TEXT NOT NULL,
        digest_hex        CHAR(64) NOT NULL
                          CHECK (digest_hex ~ '^[0-9a-f]{64}$'),
        signature         TEXT NOT NULL,
        signing_algorithm TEXT NOT NULL,
        kms_key_id        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

        UNIQUE (evidence_id, version)
      )
    `);
  }

  async appendEvidence({
    evidenceId,
    version,
    evidence,
    canonicalization,
    hashAlgorithm,
    digestHex,
    signature,
    signingAlgorithm,
    kmsKeyId = null,
  } = {}) {
    assertValidEvidenceId(evidenceId);
    assertValidVersion(version);
    assertValidEvidence(evidence);
    assertValidDigestHex(digestHex);

    if (typeof canonicalization !== "string" || canonicalization.length === 0) {
      throw new EvidenceStoreError(
        "INVALID_CANONICALIZATION",
        "canonicalization must be a non-empty string."
      );
    }

    if (typeof hashAlgorithm !== "string" || hashAlgorithm.length === 0) {
      throw new EvidenceStoreError(
        "INVALID_HASH_ALGORITHM",
        "hashAlgorithm must be a non-empty string."
      );
    }

    if (typeof signature !== "string" || signature.length === 0) {
      throw new EvidenceStoreError(
        "INVALID_SIGNATURE",
        "signature must be a non-empty string."
      );
    }

    if (typeof signingAlgorithm !== "string" || signingAlgorithm.length === 0) {
      throw new EvidenceStoreError(
        "INVALID_SIGNING_ALGORITHM",
        "signingAlgorithm must be a non-empty string."
      );
    }

    try {
      const result = await this._pool.query(
        `
          INSERT INTO evidence_versions (
            evidence_id,
            version,
            evidence,
            canonicalization,
            hash_algorithm,
            digest_hex,
            signature,
            signing_algorithm,
            kms_key_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING
            id,
            evidence_id,
            version,
            digest_hex,
            kms_key_id,
            created_at
        `,
        [
          evidenceId,
          version,
          JSON.stringify(evidence),
          canonicalization,
          hashAlgorithm,
          digestHex,
          signature,
          signingAlgorithm,
          kmsKeyId,
        ]
      );

      return mapStoredRow(result.rows[0]);
    } catch (err) {
      if (err.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new EvidenceStoreError(
          "EVIDENCE_VERSION_ALREADY_EXISTS",
          `Evidence version already exists: ${evidenceId}@${version}`,
          { cause: err }
        );
      }

      throw new EvidenceStoreError(
        "EVIDENCE_STORE_WRITE_FAILED",
        "Failed to append evidence.",
        { cause: err }
      );
    }
  }

  async getEvidenceVersion(evidenceId, version) {
    assertValidEvidenceId(evidenceId);
    assertValidVersion(version);

    try {
      const result = await this._pool.query(
        `
          SELECT
            id,
            evidence_id,
            version,
            evidence,
            canonicalization,
            hash_algorithm,
            digest_hex,
            signature,
            signing_algorithm,
            kms_key_id,
            created_at
          FROM evidence_versions
          WHERE evidence_id = $1
            AND version = $2
        `,
        [evidenceId, version]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapEvidenceRow(result.rows[0]);
    } catch (err) {
      throw new EvidenceStoreError(
        "EVIDENCE_STORE_READ_FAILED",
        "Failed to read evidence.",
        { cause: err }
      );
    }
  }

  async exists(evidenceId, version) {
    assertValidEvidenceId(evidenceId);
    assertValidVersion(version);

    try {
      const result = await this._pool.query(
        `
          SELECT 1
          FROM evidence_versions
          WHERE evidence_id = $1
            AND version = $2
          LIMIT 1
        `,
        [evidenceId, version]
      );

      return result.rows.length > 0;
    } catch (err) {
      throw new EvidenceStoreError(
        "EVIDENCE_STORE_READ_FAILED",
        "Failed to check evidence existence.",
        { cause: err }
      );
    }
  }
}

function assertValidEvidenceId(evidenceId) {
  if (typeof evidenceId !== "string" || evidenceId.trim().length === 0) {
    throw new EvidenceStoreError(
      "INVALID_EVIDENCE_ID",
      "evidenceId must be a non-empty string."
    );
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(evidenceId)) {
    throw new EvidenceStoreError(
      "INVALID_EVIDENCE_ID",
      "evidenceId must not contain control characters."
    );
  }
}

function assertValidVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw new EvidenceStoreError(
      "INVALID_VERSION",
      "version must be an integer greater than or equal to 1."
    );
  }
}

function assertValidEvidence(evidence) {
  if (
    evidence === null ||
    typeof evidence !== "object" ||
    Array.isArray(evidence)
  ) {
    throw new EvidenceStoreError(
      "INVALID_EVIDENCE",
      "evidence must be a non-null object."
    );
  }
}

function assertValidDigestHex(digestHex) {
  if (
    typeof digestHex !== "string" ||
    !/^[0-9a-f]{64}$/.test(digestHex)
  ) {
    throw new EvidenceStoreError(
      "INVALID_DIGEST",
      "digestHex must be a 64-character lowercase SHA-256 hex string."
    );
  }
}

function mapStoredRow(row) {
  return {
    id: Number(row.id),
    evidenceId: row.evidence_id,
    version: Number(row.version),
    digestHex: row.digest_hex,
    kmsKeyId: row.kms_key_id,
    createdAt: row.created_at,
  };
}

function mapEvidenceRow(row) {
  return {
    id: Number(row.id),
    evidenceId: row.evidence_id,
    version: Number(row.version),
    evidence: row.evidence,
    canonicalization: row.canonicalization,
    hashAlgorithm: row.hash_algorithm,
    digestHex: row.digest_hex,
    signature: row.signature,
    signingAlgorithm: row.signing_algorithm,
    kmsKeyId: row.kms_key_id,
    createdAt: row.created_at,
  };
}

module.exports = {
  PgEvidenceStore,
  EvidenceStoreError,
  assertValidEvidenceId,
  assertValidVersion,
  assertValidDigestHex,
};