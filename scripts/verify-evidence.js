const fs = require("node:fs");
const path = require("node:path");
const { hashFile } = require("../lib/audit");

const filePath = process.argv[2];
const expectedInput = process.argv[3];

function isSha256Hex(value) {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

function readExpectedHash(input) {
  if (isSha256Hex(input)) {
    return input.toLowerCase();
  }

  const expectedHashFilePath = path.resolve(input);
  const content = fs.readFileSync(expectedHashFilePath, "utf8").trim();
  const expectedHash = content.split(/\s+/)[0];

  if (!isSha256Hex(expectedHash)) {
    throw new Error(
      `Expected hash file must start with a 64-character SHA-256 hex digest: ${input}`
    );
  }

  return expectedHash.toLowerCase();
}

if (!filePath || !expectedInput) {
  console.error("Usage:");
  console.error("  node scripts/verify-evidence.js <evidence-file> <expected-sha256-hash>");
  console.error("  node scripts/verify-evidence.js <evidence-file> <expected-sha256-file>");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/verify-evidence.js samples/evidence-consent.json abc123...");
  console.error("  node scripts/verify-evidence.js samples/evidence-consent.json samples/evidence-consent.expected.sha256");
  process.exit(1);
}

(async () => {
  try {
    const expectedHash = readExpectedHash(expectedInput);
    const calculatedHash = await hashFile(filePath);
    const result = calculatedHash === expectedHash ? "VALID" : "INVALID";

    console.log("Evidence file:", filePath);
    console.log("Canonicalization: RFC 8785 JSON Canonicalization Scheme (JCS)");
    console.log("Expected hash:", expectedHash);
    console.log("Calculated hash:", calculatedHash);
    console.log("Verification result:", result);

    process.exit(result === "VALID" ? 0 : 2);
  } catch (error) {
    console.error("Failed to verify evidence file.");
    console.error(error.message);
    process.exit(1);
  }
})();
