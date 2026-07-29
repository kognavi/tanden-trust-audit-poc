const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath originates from CLI-invoked callers only (scripts/verify-evidence.js, scripts/hash-evidence.js via process.argv); not exposed to untrusted/network input in current codebase.
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(rawContent);
}

function createValidator(schema) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false
  });

  addFormats(ajv);

  return ajv.compile(schema);
}

function validateEvidenceAgainstSchema(evidence, schema) {
  const validate = createValidator(schema);
  const isValid = validate(evidence);

  return {
    isValid,
    errors: validate.errors || []
  };
}

function validateEvidenceFile(evidenceFilePath, schemaFilePath) {
  const evidence = readJsonFile(evidenceFilePath);
  const schema = readJsonFile(schemaFilePath);

  return validateEvidenceAgainstSchema(evidence, schema);
}

module.exports = {
  readJsonFile,
  validateEvidenceAgainstSchema,
  validateEvidenceFile
};
