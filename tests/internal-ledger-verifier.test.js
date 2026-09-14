"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PgInternalLedgerVerifier,
} = require("../lib/internal-ledger-verifier");

const ledgerEventId = "11111111-1111-4111-8111-111111111111";
const evidenceId = "evidence-anchor-001";
const digestHex = "a".repeat(64);
const rowHash = "b".repeat(64);

function makeLogger({ integrity = { valid: true }, event } = {}) {
  const calls = [];
  return {
    calls,
    async verifyChainIntegrity() {
      calls.push("verifyChainIntegrity");
      return integrity;
    },
    async getEventById(eventId) {
      calls.push(["getEventById", eventId]);
      return event === undefined
        ? {
            eventId: ledgerEventId,
            eventType: "evidence.stored",
            payload: { evidenceId, digestHex },
            rowHash,
          }
        : event;
    },
  };
}

test("confirms an exact evidence.stored row only after full-chain verification", async () => {
  const pgLogger = makeLogger();
  const verifier = new PgInternalLedgerVerifier({ pgLogger });
  const result = await verifier.verifyRecordedEvidence({
    ledgerEventId,
    evidenceId,
    digestHex,
  });

  assert.deepEqual(result, { confirmed: true, eventId: ledgerEventId, rowHash });
  assert.deepEqual(pgLogger.calls, [
    "verifyChainIntegrity",
    ["getEventById", ledgerEventId],
  ]);
});

test("invalid chain fails before event lookup", async () => {
  const pgLogger = makeLogger({ integrity: { valid: false } });
  const verifier = new PgInternalLedgerVerifier({ pgLogger });
  assert.deepEqual(
    await verifier.verifyRecordedEvidence({ ledgerEventId, evidenceId, digestHex }),
    { confirmed: false, reason: "LEDGER_CHAIN_INVALID" }
  );
  assert.deepEqual(pgLogger.calls, ["verifyChainIntegrity"]);
});

test("missing, wrong-type, mismatched, and invalid-hash rows fail closed", async (t) => {
  const cases = [
    ["missing", null, "LEDGER_EVENT_NOT_FOUND"],
    ["wrong type", { eventId: ledgerEventId, eventType: "evidence.verified", payload: { evidenceId, digestHex }, rowHash }, "LEDGER_EVENT_TYPE_MISMATCH"],
    ["mismatch", { eventId: ledgerEventId, eventType: "evidence.stored", payload: { evidenceId: "other", digestHex }, rowHash }, "LEDGER_EVIDENCE_MISMATCH"],
    ["invalid row hash", { eventId: ledgerEventId, eventType: "evidence.stored", payload: { evidenceId, digestHex }, rowHash: "invalid" }, "LEDGER_ROW_HASH_INVALID"],
  ];

  for (const [name, event, reason] of cases) {
    await t.test(name, async () => {
      const verifier = new PgInternalLedgerVerifier({ pgLogger: makeLogger({ event }) });
      assert.deepEqual(
        await verifier.verifyRecordedEvidence({ ledgerEventId, evidenceId, digestHex }),
        { confirmed: false, reason }
      );
    });
  }
});

test("validates constructor and request contract", async () => {
  assert.throws(() => new PgInternalLedgerVerifier(), /requires a pgLogger/);
  const verifier = new PgInternalLedgerVerifier({ pgLogger: makeLogger() });
  await assert.rejects(
    () => verifier.verifyRecordedEvidence({ ledgerEventId: "", evidenceId, digestHex }),
    /ledgerEventId/
  );
  await assert.rejects(
    () => verifier.verifyRecordedEvidence({ ledgerEventId, evidenceId: "", digestHex }),
    /evidenceId/
  );
  await assert.rejects(
    () => verifier.verifyRecordedEvidence({ ledgerEventId, evidenceId, digestHex: "invalid" }),
    (error) => error.code === "INVALID_DIGEST"
  );
});
