"use strict";

const { Pool } = require("pg");
const {
  PgEvidenceStore,
  EvidenceStoreError,
} = require("../lib/pg-evidence-store");

async function main() {
  const pool = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "tanden_audit",
    user: "postgres",
    password: "localdev_only_password",
  });

  const store = new PgEvidenceStore({ pool });

  const evidenceId = `pg-e2e-${Date.now()}`;

  const input = {
    evidenceId,
    version: 1,
    evidence: {
      evidenceId,
      type: "pg-evidence-store-e2e",
      status: "approved",
    },
    canonicalization: "RFC8785",
    hashAlgorithm: "SHA-256",
    digestHex: "a".repeat(64),
    signature: "test-signature",
    signingAlgorithm: "ECDSA_SHA_256",
    kmsKeyId: null,
  };

  try {
    console.log("1. Initializing schema...");
    await store.initializeSchema();

    console.log("2. Appending evidence...");
    const inserted = await store.appendEvidence(input);

    console.log("Inserted:", inserted);

    console.log("3. Reading evidence...");
    const stored = await store.getEvidenceVersion(evidenceId, 1);

    if (!stored) {
      throw new Error("Stored evidence was not found.");
    }

    console.log("Read OK:", {
      evidenceId: stored.evidenceId,
      version: stored.version,
      digestHex: stored.digestHex,
    });

    console.log("4. Checking exists...");
    const exists = await store.exists(evidenceId, 1);

    if (!exists) {
      throw new Error("exists() unexpectedly returned false.");
    }

    console.log("exists() = true");

    console.log("5. Verifying duplicate rejection...");

    try {
      await store.appendEvidence(input);

      throw new Error(
        "Duplicate append unexpectedly succeeded."
      );
    } catch (err) {
      if (
        err instanceof EvidenceStoreError &&
        err.code === "EVIDENCE_VERSION_ALREADY_EXISTS"
      ) {
        console.log(
          "Duplicate correctly rejected:",
          err.code
        );
      } else {
        throw err;
      }
    }

    console.log("PostgreSQL PgEvidenceStore E2E: PASS");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("PostgreSQL PgEvidenceStore E2E: FAIL");
  console.error(err);
  process.exitCode = 1;
});