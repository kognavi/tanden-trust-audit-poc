const { hashFile, verifyFile } = require("../lib/audit");

const filePath = process.argv[2];
const expectedHash = process.argv[3];

if (!filePath || !expectedHash) {
  console.error("Usage:");
  console.error("  node scripts/verify-evidence.js <evidence-file> <expected-sha256-hash>");
  console.error("");
  console.error("Example:");
  console.error("  node scripts/verify-evidence.js samples/evidence-consent.json abc123...");
  process.exit(1);
}

try {
  const calculatedHash = hashFile(filePath);
  const result = calculatedHash === expectedHash ? "VALID" : "INVALID";

  console.log("Evidence file:", filePath);
  console.log("Expected hash:", expectedHash);
  console.log("Calculated hash:", calculatedHash);
  console.log("Verification result:", result);

  process.exit(result === "VALID" ? 0 : 2);
} catch (error) {
  console.error("Failed to verify evidence file.");
  console.error(error.message);
  process.exit(1);
}
