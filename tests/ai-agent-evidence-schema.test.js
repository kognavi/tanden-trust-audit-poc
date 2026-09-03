const test = require("node:test");
const assert = require("node:assert/strict");

const {
  readJsonFile,
  validateEvidenceAgainstSchema
} = require("../lib/schema-validation");

const schema = readJsonFile("schemas/ai-agent-evidence.schema.json");
const validEvidence = readJsonFile("samples/ai-agent-tool-call.json");

test("AI agent evidence profile", async (t) => {
  await t.test("accepts a synthetic agent tool-call evidence record", () => {
    const result = validateEvidenceAgainstSchema(validEvidence, schema);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, []);
  });

  await t.test("rejects evidence without policy context", () => {
    const evidence = structuredClone(validEvidence);
    delete evidence.policy;

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "required"),
      true
    );
  });

  await t.test("rejects raw prompt fields that are outside the evidence profile", () => {
    const evidence = structuredClone(validEvidence);
    evidence.rawPrompt = "do not store raw prompts in this profile";

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "additionalProperties"),
      true
    );
  });

  await t.test("requires reviewer attribution for approved actions", () => {
    const evidence = structuredClone(validEvidence);
    delete evidence.approval.approverId;

    const result = validateEvidenceAgainstSchema(evidence, schema);

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.some((error) => error.keyword === "required"),
      true
    );
  });
});
