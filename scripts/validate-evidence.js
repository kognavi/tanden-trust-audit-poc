const { validateEvidenceFile } = require("../lib/schema-validation");

const evidenceFilePath = process.argv[2] || "samples/evidence-consent.json";
const schemaFilePath = process.argv[3] || "schemas/evidence.schema.json";

try {
  const result = validateEvidenceFile(evidenceFilePath, schemaFilePath);

  console.log("Evidence file:", evidenceFilePath);
  console.log("Schema file:", schemaFilePath);
  console.log("Schema validation result:", result.isValid ? "VALID" : "INVALID");

  if (!result.isValid) {
    console.error("Validation errors:");
    console.error(JSON.stringify(result.errors, null, 2));
    process.exit(2);
  }

  process.exit(0);
} catch (error) {
  console.error("Failed to validate evidence file.");
  console.error(error.message);
  process.exit(1);
}
