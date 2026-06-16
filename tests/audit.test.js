const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  canonicalizeJson,
  hashJson,
  hashFile,
  verifyFile
} = require("../lib/audit");

const SAMPLE_FILE = path.resolve(__dirname, "../samples/evidence-consent.json");
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const TAMPERED_FILE = path.join(FIXTURES_DIR, "tampered-consent.json");
const MISSING_FILE = path.join(FIXTURES_DIR, "does-not-exist.json");

function writeTamperedFile() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const original = fs.readFileSync(SAMPLE_FILE, "utf8");
  fs.writeFileSync(TAMPERED_FILE, original.replace('"granted"', '"revoked"'), "utf8");
}

function cleanupFixtures() {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

describe("evidence hash & verification", () => {
  let validHash;

  before(async () => {
    validHash = await hashFile(SAMPLE_FILE);
    writeTamperedFile();
  });

  after(() => {
    cleanupFixtures();
  });

  it("returns VALID for untampered evidence", async () => {
    assert.equal(await verifyFile(SAMPLE_FILE, validHash), "VALID");
  });

  it("returns INVALID when evidence file has been tampered with", async () => {
    assert.equal(await verifyFile(TAMPERED_FILE, validHash), "INVALID");
  });

  it("returns INVALID when the expected hash is wrong", async () => {
    assert.equal(await verifyFile(SAMPLE_FILE, "0".repeat(64)), "INVALID");
  });

  it("throws when the evidence file does not exist", async () => {
    await assert.rejects(async () => {
      await hashFile(MISSING_FILE);
    }, { code: "ENOENT" });
  });

  it("produces the same hash on repeated calls", async () => {
    assert.equal(await hashFile(SAMPLE_FILE), await hashFile(SAMPLE_FILE));
  });

  it("canonicalizes objects using stable JCS key ordering", async () => {
    const canonicalJson = await canonicalizeJson({
      b: 2,
      a: 1
    });

    assert.equal(canonicalJson, '{"a":1,"b":2}');
  });

  it("produces the same hash for objects with different key order", async () => {
    const evidenceA = {
      evidenceId: "evd-test-001",
      schemaVersion: "1.0.0",
      eventType: "CONSENT_GRANTED",
      occurredAt: "2026-06-02T03:00:00Z",
      subjectId: "subject-demo-001",
      actorId: "actor-demo-001",
      sourceSystem: "tanden-trust-audit-poc",
      hashAlgorithm: "SHA-256",
      purpose: "test",
      consent: {
        status: "granted",
        scope: ["activity_recording", "audit_verification"],
        version: "v1.0"
      },
      metadata: {
        environment: "demo",
        containsPersonalData: false,
        notes: "test"
      }
    };

    const evidenceB = {
      metadata: {
        notes: "test",
        containsPersonalData: false,
        environment: "demo"
      },
      consent: {
        version: "v1.0",
        scope: ["activity_recording", "audit_verification"],
        status: "granted"
      },
      purpose: "test",
      hashAlgorithm: "SHA-256",
      sourceSystem: "tanden-trust-audit-poc",
      actorId: "actor-demo-001",
      subjectId: "subject-demo-001",
      occurredAt: "2026-06-02T03:00:00Z",
      eventType: "CONSENT_GRANTED",
      schemaVersion: "1.0.0",
      evidenceId: "evd-test-001"
    };

    assert.equal(
      (await hashJson(evidenceA)).hash,
      (await hashJson(evidenceB)).hash
    );
  });

  it("produces a different hash when array order changes", async () => {
    const baseEvidence = {
      evidenceId: "evd-test-001",
      schemaVersion: "1.0.0",
      eventType: "CONSENT_GRANTED",
      occurredAt: "2026-06-02T03:00:00Z",
      subjectId: "subject-demo-001",
      actorId: "actor-demo-001",
      sourceSystem: "tanden-trust-audit-poc",
      hashAlgorithm: "SHA-256",
      purpose: "test",
      consent: {
        status: "granted",
        scope: ["activity_recording", "audit_verification"],
        version: "v1.0"
      },
      metadata: {
        environment: "demo",
        containsPersonalData: false,
        notes: "test"
      }
    };

    const changedArrayOrder = {
      ...baseEvidence,
      consent: {
        ...baseEvidence.consent,
        scope: ["audit_verification", "activity_recording"]
      }
    };

    assert.notEqual(
      (await hashJson(baseEvidence)).hash,
      (await hashJson(changedArrayOrder)).hash
    );
  });
});
