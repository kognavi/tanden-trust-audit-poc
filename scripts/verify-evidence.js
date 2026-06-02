const fs = require("fs");
const crypto = require("crypto");

const filePath = process.argv[2];
const expectedHash = process.argv[3];

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalizeJson(value[key]);
        return result;
      }, {});
  }

  return value;
}

function calculateSha256Hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

if (!filePath || !expectedHash) {
  console.error("Usage:");
  console.error("  node scripts/verify-evidence.js <evidence-file> <expected-sha256-hash>");
  console.error("");
  console.error("Example:");
  console.error("  node scripts/verify-evidence.js samples/evidence-consent.json abc123...");
  process.exit(1);
}

try {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);
  const canonicalJson = JSON.stringify(canonicalizeJson(parsedJson));
  const calculatedHash = calculateSha256Hash(canonicalJson);

  console.log("Evidence file:", filePath);
  console.log("Expected hash:", expectedHash);
  console.log("Calculated hash:", calculatedHash);

  if (calculatedHash === expectedHash) {
    console.log("Verification result: VALID");
    process.exit(0);
  } else {
    console.log("Verification result: INVALID");
    process.exit(2);
  }
} catch (error) {
  console.error("Failed to verify evidence file.");
  console.error(error.message);
  process.exit(1);
}
