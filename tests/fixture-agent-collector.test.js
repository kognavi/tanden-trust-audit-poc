"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fixture = require("../fixtures/agent-tool-call.normalized.json");
const { FixtureAgentCollector } = require("../lib/collectors/fixture-agent-collector");
const { NormalizedAgentEventValidationError } = require("../lib/normalized-agent-event");

test("FixtureAgentCollector returns an isolated normalized event", async () => {
  const collector = new FixtureAgentCollector({ fixture });
  const first = await collector.collect();
  first.action.target = "synthetic://mutated";

  const second = await collector.collect();

  assert.equal(second.action.target, fixture.action.target);
  assert.notEqual(first, second);
});

test("FixtureAgentCollector fails closed for an invalid fixture", async () => {
  const invalid = structuredClone(fixture);
  delete invalid.approval;

  const collector = new FixtureAgentCollector({ fixture: invalid });

  await assert.rejects(
    () => collector.collect(),
    (error) => {
      assert.ok(error instanceof NormalizedAgentEventValidationError);
      return true;
    }
  );
});
