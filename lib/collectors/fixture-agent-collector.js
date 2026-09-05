"use strict";

const { assertNormalizedAgentEvent } = require("../normalized-agent-event");

class FixtureAgentCollector {
  constructor({ fixture } = {}) {
    if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
      throw new Error("FixtureAgentCollector requires a fixture object.");
    }
    this._fixture = structuredClone(fixture);
  }

  async collect() {
    const event = structuredClone(this._fixture);
    assertNormalizedAgentEvent(event);
    return event;
  }
}

module.exports = {
  FixtureAgentCollector,
};
