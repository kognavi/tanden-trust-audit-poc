const test = require("node:test");
const assert = require("node:assert/strict");

const {
  readJsonFile,
  validateEvidenceAgainstSchema
} = require("../lib/schema-validation");

const schema = readJsonFile("schemas/evidence.schema.json");
const validEvidence = readJsonFile("samples/evidence-consent.json");

test("JSON Schema validation", async (t) => {
  await t.test("returns VALID for valid evidence", () => {
    const result = validateEvidenceAgainstSchema(validEvidence, schema);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, []);
  });

  await t.test("returns INVALID when required field is missing", () => {
    const evidence = structuredClone(validEvidence);
    delete evidence.evidenceId;

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "required"),
      true
    );
  });

  await t.test("returns INVALID when occurredAt is not date-time", () => {
    const evidence = structuredClone(validEvidence);
    evidence.occurredAt = "2026/06/02 03:00:00";

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "format"),
      true
    );
  });

  await t.test("returns INVALID when additional property exists", () => {
    const evidence = structuredClone(validEvidence);
    evidence.unexpectedField = "not allowed";

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "additionalProperties"),
      true
    );
  });

  await t.test("returns INVALID when consent status is not allowed", () => {
    const evidence = structuredClone(validEvidence);
    evidence.consent.status = "pending";

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "enum"),
      true
    );
  });
});
