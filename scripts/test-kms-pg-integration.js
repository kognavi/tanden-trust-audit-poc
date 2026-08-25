"use strict";

require("dotenv").config();

const crypto = require("node:crypto");
const { Pool } = require("pg");

const { AwsKmsProvider } = require("../lib/aws-kms-provider");
const {
  PgEvidenceStore,
  EvidenceStoreError,
} = require("../lib/pg-evidence-store");
const {
  canonicalizeValue,
} = require("../lib/canonicalize-loader");

async function calculateDigestHex(evidence) {
  const canonicalJson = await canonicalizeValue(evidence);

  return crypto
    .createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex");
}

async function main() {
  if (!process.env.KMS_KEY_ID) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  const pool = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "tanden_audit",
    user: "postgres",
    password: "localdev_only_password",
  });

  const provider = new AwsKmsProvider();
  const store = new PgEvidenceStore({ pool });

  const evidenceId = `kms-pg-e2e-${Date.now()}`;

  const evidence = {
    evidenceId,
    type: "kms-pg-e2e",
    status: "approved",
    occurredAt: new Date().toISOString(),
  };

  try {
    console.log("=== AWS KMS + PostgreSQL E2E ===");

    console.log("[1] Initializing PostgreSQL schema...");
    await store.initializeSchema();

    console.log("[2] Calculating SHA-256 digest...");
    const digestHex = await calculateDigestHex(evidence);

    console.log("digestHex:", digestHex);

    console.log("[3] Signing evidence with AWS KMS...");
    const signResult = await provider.signEvidence(evidence);

    if (!signResult.signature) {
      throw new Error("KMS signing did not return a signature.");
    }

    if (!signResult.kmsKeyId) {
      throw new Error("KMS signing did not return kmsKeyId.");
    }

    console.log("KMS signing: OK");
    console.log("Resolved physical KMS key:", signResult.kmsKeyId);

    console.log("[4] Storing signed evidence in PostgreSQL...");

    await store.appendEvidence({
      evidenceId,
      version: 1,
      evidence,
      canonicalization: "RFC8785",
      hashAlgorithm: "SHA-256",
      digestHex,
      signature: signResult.signature.toString("base64"),
      signingAlgorithm: "ECDSA_SHA_256",
      kmsKeyId: signResult.kmsKeyId,
    });

    console.log("PostgreSQL append: OK");

    console.log("[5] Reading evidence back from PostgreSQL...");

    const stored = await store.getEvidenceVersion(evidenceId, 1);

    if (!stored) {
      throw new Error("Stored evidence was not found.");
    }

    console.log("PostgreSQL read: OK");

    console.log("[6] Recalculating digest from stored evidence...");

    const recalculatedDigestHex =
      await calculateDigestHex(stored.evidence);

    if (recalculatedDigestHex !== stored.digestHex) {
      throw new Error(
        "Digest mismatch after PostgreSQL round trip."
      );
    }

    console.log("Digest match: OK");

    console.log("[7] Verifying stored signature with AWS KMS...");

    const verifyResult = await provider.verifyEvidenceSignature(
      stored.evidence,
      Buffer.from(stored.signature, "base64")
    );

    if (!verifyResult.valid) {
      throw new Error("KMS verification returned valid=false.");
    }

    console.log("KMS verification: true");

    if (
      stored.kmsKeyId &&
      verifyResult.kmsKeyId &&
      stored.kmsKeyId !== verifyResult.kmsKeyId
    ) {
      throw new Error(
        "Physical KMS key ID mismatch between signing and verification."
      );
    }

    console.log("Physical KMS key traceability: OK");

    console.log("[8] Verifying tamper detection...");

    const tamperedEvidence = {
      ...stored.evidence,
      status: "tampered",
    };

    const tamperedResult =
      await provider.verifyEvidenceSignature(
        tamperedEvidence,
        Buffer.from(stored.signature, "base64")
      );

    if (tamperedResult.valid) {
      throw new Error(
        "Tampered evidence unexpectedly passed signature verification."
      );
    }

    console.log("Tamper detection: OK");

    console.log("=== AWS KMS + PostgreSQL E2E: PASS ===");
  } catch (err) {
    if (err instanceof EvidenceStoreError) {
      console.error("EvidenceStoreError:", err.code);
    }

    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("=== AWS KMS + PostgreSQL E2E: FAIL ===");
  console.error(err);
  process.exitCode = 1;
});