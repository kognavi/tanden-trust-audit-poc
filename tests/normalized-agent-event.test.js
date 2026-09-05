"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fixture = require("../fixtures/agent-tool-call.normalized.json");
const {
  validateNormalizedAgentEvent,
  assertNormalizedAgentEvent,
  NormalizedAgentEventValidationError,
} = require("../lib/normalized-agent-event");

test("normalized Agent event contract accepts the synthetic fixture", () => {
  const result = validateNormalizedAgentEvent(fixture);
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
});

test("normalized Agent event contract rejects raw prompt fields", () => {
  const event = structuredClone(fixture);
  event.rawPrompt = "sensitive prompt text";

  assert.throws(
    () => assertNormalizedAgentEvent(event),
    (error) => {
      assert.ok(error instanceof NormalizedAgentEventValidationError);
      assert.equal(error.code, "NORMALIZED_AGENT_EVENT_INVALID");
      assert.equal(
        error.validationErrors.some((item) => item.keyword === "additionalProperties"),
        true
      );
      return true;
    }
  );
});

test("normalized Agent event contract rejects secret-bearing evidence", () => {
  const event = structuredClone(fixture);
  event.metadata.containsSecrets = true;

  const result = validateNormalizedAgentEvent(event);
  assert.equal(result.isValid, false);
  assert.equal(
    result.errors.some((item) => item.keyword === "const"),
    true
  );
});

test("normalized Agent event contract rejects missing policy context", () => {
  const event = structuredClone(fixture);
  delete event.policy;

  const result = validateNormalizedAgentEvent(event);
  assert.equal(result.isValid, false);
  assert.equal(
    result.errors.some((item) => item.keyword === "required"),
    true
  );
});

test("normalized Agent event contract rejects approved actions without approver attribution", () => {
  const event = structuredClone(fixture);
  delete event.approval.approverId;

  const result = validateNormalizedAgentEvent(event);
  assert.equal(result.isValid, false);
  assert.equal(
    result.errors.some((item) => item.keyword === "required"),
    true
  );
});
