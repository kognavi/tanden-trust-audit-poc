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

  // canonicalJson は計算の中間値であり、呼び出し元での誤った永続化を防ぐため
  // 戻り値に含めない（H5 データ最小化）。
  return {
    hash,
    canonicalization: "RFC 8785 JSON Canonicalization Scheme (JCS)"
  };
}

async function hashFile(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is passed in by callers; current callers (scripts/verify-evidence.js, scripts/hash-evidence.js) source it from process.argv (operator-trusted CLI input). Revisit if this function is ever exposed via a network-facing API.
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent);
  const result = await hashJson(parsedJson);

  return result.hash;
}

async function hashFileWithDetails(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is passed in by callers; current callers (scripts/verify-evidence.js, scripts/hash-evidence.js) source it from process.argv (operator-trusted CLI input). Revisit if this function is ever exposed via a network-facing API.
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
