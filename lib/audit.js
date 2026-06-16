const fs = require("fs");
const crypto = require("crypto");

let canonicalizeFunctionPromise;

async function loadCanonicalizeFunction() {
  if (!canonicalizeFunctionPromise) {
    canonicalizeFunctionPromise = import("canonicalize").then((module) => {
      const canonicalize = module.default || module;

      if (typeof canonicalize !== "function") {
        throw new Error("Failed to load canonicalize function");
      }

      return canonicalize;
    });
  }

  return canonicalizeFunctionPromise;
}

async function canonicalizeJson(value) {
  const canonicalize = await loadCanonicalizeFunction();
  const canonicalJson = canonicalize(value);

  if (typeof canonicalJson !== "string") {
    throw new Error("Failed to canonicalize JSON using RFC 8785 JCS");
  }

  return canonicalJson;
}

async function hashJson(value) {
  const canonicalJson = await canonicalizeJson(value);

  const hash = crypto
    .createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex");

  return {
    canonicalJson,
    hash,
    canonicalization: "RFC 8785 JSON Canonicalization Scheme (JCS)"
  };
}

async function hashFile(filePath) {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);
  const result = await hashJson(parsedJson);

  return result.hash;
}

async function hashFileWithDetails(filePath) {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);

  return hashJson(parsedJson);
}

async function verifyFile(filePath, expectedHash) {
  const actualHash = await hashFile(filePath);
  return actualHash === expectedHash ? "VALID" : "INVALID";
}

module.exports = {
  canonicalizeJson,
  hashJson,
  hashFile,
  hashFileWithDetails,
  verifyFile
};
