"use strict";

const { assertValidDigestHex } = require("./pg-evidence-store");

const EVIDENCE_STORED_EVENT_TYPE = "evidence.stored";

class PgInternalLedgerVerifier {
  constructor({ pgLogger } = {}) {
    if (
      !pgLogger ||
      typeof pgLogger.verifyChainIntegrity !== "function" ||
      typeof pgLogger.getEventById !== "function"
    ) {
      throw new Error(
        "PgInternalLedgerVerifier requires a pgLogger implementing verifyChainIntegrity() and getEventById()."
      );
    }
    this._pgLogger = pgLogger;
  }

  async verifyRecordedEvidence({ ledgerEventId, evidenceId, digestHex } = {}) {
    assertNonEmptyString(ledgerEventId, "ledgerEventId");
    assertNonEmptyString(evidenceId, "evidenceId");
    assertValidDigestHex(digestHex);

    const integrity = await this._pgLogger.verifyChainIntegrity();
    if (integrity?.valid !== true) {
      return { confirmed: false, reason: "LEDGER_CHAIN_INVALID" };
    }

    const event = await this._pgLogger.getEventById(ledgerEventId);
    if (!event) return { confirmed: false, reason: "LEDGER_EVENT_NOT_FOUND" };
    if (event.eventType !== EVIDENCE_STORED_EVENT_TYPE) {
      return { confirmed: false, reason: "LEDGER_EVENT_TYPE_MISMATCH" };
    }
    if (
      event.payload?.evidenceId !== evidenceId ||
      event.payload?.digestHex !== digestHex
    ) {
      return { confirmed: false, reason: "LEDGER_EVIDENCE_MISMATCH" };
    }
    if (!/^[0-9a-f]{64}$/.test(event.rowHash ?? "")) {
      return { confirmed: false, reason: "LEDGER_ROW_HASH_INVALID" };
    }

    return {
      confirmed: true,
      eventId: event.eventId,
      rowHash: event.rowHash,
    };
  }
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}

module.exports = {
  PgInternalLedgerVerifier,
  EVIDENCE_STORED_EVENT_TYPE,
};
