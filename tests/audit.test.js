const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { hashFile, verifyFile } = require("../lib/audit");

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

  before(() => {
    validHash = hashFile(SAMPLE_FILE);
    writeTamperedFile();
  });

  after(() => {
    cleanupFixtures();
  });

  it("returns VALID for untampered evidence", () => {
    assert.equal(verifyFile(SAMPLE_FILE, validHash), "VALID");
  });

  it("returns INVALID when evidence file has been tampered with", () => {
    assert.equal(verifyFile(TAMPERED_FILE, validHash), "INVALID");
  });

  it("returns INVALID when the expected hash is wrong", () => {
    assert.equal(verifyFile(SAMPLE_FILE, "0".repeat(64)), "INVALID");
  });

  it("throws when the evidence file does not exist", () => {
    assert.throws(() => hashFile(MISSING_FILE), { code: "ENOENT" });
  });

  it("produces the same hash on repeated calls", () => {
    assert.equal(hashFile(SAMPLE_FILE), hashFile(SAMPLE_FILE));
  });
});
