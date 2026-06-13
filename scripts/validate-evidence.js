const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const evidenceFilePath = process.argv[2] || "samples/evidence-consent.json";
const schemaFilePath = process.argv[3] || "schemas/evidence.schema.json";

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(rawContent);
}

try {
  const evidence = readJsonFile(evidenceFilePath);
  const schema = readJsonFile(schemaFilePath);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });

  addFormats(ajv);

  const validate = ajv.compile(schema);
  const isValid = validate(evidence);

  console.log("Evidence file:", evidenceFilePath);
  console.log("Schema file:", schemaFilePath);
  console.log("Schema validation result:", isValid ? "VALID" : "INVALID");

  if (!isValid) {
    console.error("Validation errors:");
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(2);
  }

  process.exit(0);
} catch (error) {
  console.error("Failed to validate evidence file.");
  console.error(error.message);
  process.exit(1);
}
