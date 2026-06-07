const fs = require("fs");
const crypto = require("crypto");

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

function hashFile(filePath) {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);
  const canonicalJson = JSON.stringify(canonicalizeJson(parsedJson));
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}

function verifyFile(filePath, expectedHash) {
  return hashFile(filePath) === expectedHash ? "VALID" : "INVALID";
}

module.exports = { hashFile, verifyFile };
