const { hashFile } = require("../lib/audit");
const fs = require("fs");
const crypto = require("crypto");

const filePath = process.argv[2] || "samples/evidence-consent.json";

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

try {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);
  const canonicalJson = JSON.stringify(canonicalizeJson(parsedJson));
  const hash = crypto.createHash("sha256").update(canonicalJson).digest("hex");

  console.log("Evidence file:", filePath);
  console.log("Canonical JSON:", canonicalJson);
  console.log("SHA-256 hash:", hash);
} catch (error) {
  console.error("Failed to hash evidence file.");
  console.error(error.message);
  process.exit(1);
}
