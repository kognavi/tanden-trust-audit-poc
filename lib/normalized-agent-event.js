"use strict";

const schema = require("../schemas/normalized-agent-event.schema.json");
const { validateEvidenceAgainstSchema } = require("./schema-validation");

class NormalizedAgentEventValidationError extends Error {
  constructor(errors) {
    super("Normalized Agent event failed contract validation.");
    this.name = "NormalizedAgentEventValidationError";
    this.code = "NORMALIZED_AGENT_EVENT_INVALID";
    this.validationErrors = errors;
  }
}

function validateNormalizedAgentEvent(event) {
  return validateEvidenceAgainstSchema(event, schema);
}

function assertNormalizedAgentEvent(event) {
  const result = validateNormalizedAgentEvent(event);
  if (!result.isValid) {
    throw new NormalizedAgentEventValidationError(result.errors);
  }
  return event;
}

module.exports = {
  validateNormalizedAgentEvent,
  assertNormalizedAgentEvent,
  NormalizedAgentEventValidationError,
};
