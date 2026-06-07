const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const evidenceFile = "samples/evidence-consent.json";
const expectedHash = "ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c";

function runNodeScript(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

test("hash-evidence calculates the expected SHA-256 hash for the sample evidence", () => {
  const result = runNodeScript(["scripts/hash-evidence.js", evidenceFile]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Evidence file: samples\/evidence-consent\.json/);
  assert.match(result.stdout, new RegExp(`SHA-256 hash: ${expectedHash}`));
  assert.equal(result.stderr, "");
});

test("verify-evidence returns success for a valid evidence hash", () => {
  const result = runNodeScript([
    "scripts/verify-evidence.js",
    evidenceFile,
    expectedHash,
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Verification result: VALID/);
  assert.equal(result.stderr, "");
});

test("verify-evidence returns exit code 2 for an invalid evidence hash", () => {
  const invalidHash = "0".repeat(64);

  const result = runNodeScript([
    "scripts/verify-evidence.js",
    evidenceFile,
    invalidHash,
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stdout, /Verification result: INVALID/);
  assert.equal(result.stderr, "");
});

test("verify-evidence returns usage error when required arguments are missing", () => {
  const result = runNodeScript(["scripts/verify-evidence.js"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.match(
    result.stderr,
    /node scripts\/verify-evidence\.js <evidence-file> <expected-sha256-hash>/
  );
});
