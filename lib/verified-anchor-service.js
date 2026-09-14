"use strict";

const { validateSidecarMetadataV2 } = require("./metadata");
const { assertValidDigestHex } = require("./pg-evidence-store");
const { verifyEvidenceWithSidecarMetadata } = require("./sidecar-verifier");

const ZERO_DIGEST_HEX = "0".repeat(64);
const ANCHOR_VERIFICATION_SCHEMA = "tanden.external-anchor.v1";

class VerificationGateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "VerificationGateError";
    this.code = code;
  }
}

class InternalLedgerVerificationError extends Error {
  constructor(reason, options = {}) {
    super("Internal Ledger did not confirm the verified Evidence.", options);
    this.name = "InternalLedgerVerificationError";
    this.code = "INTERNAL_LEDGER_NOT_CONFIRMED";
    this.reason = reason;
  }
}

class AlreadyAnchoredError extends Error {
  constructor(digestHex, anchoredAt) {
    super(`Digest is already anchored: ${digestHex}`);
    this.name = "AlreadyAnchoredError";
    this.code = "DIGEST_ALREADY_ANCHORED";
    this.digestHex = digestHex;
    this.anchoredAt = anchoredAt;
  }
}

class AnchorTransactionError extends Error {
  constructor(digestHex, operation, cause) {
    super(
      "Verified digest could not be anchored. Off-chain Evidence, Store, and Ledger state was not rolled back.",
      { cause }
    );
    this.name = "AnchorTransactionError";
    this.code = "WEB3_ANCHOR_FAILED";
    this.digestHex = digestHex;
    this.operation = operation;
  }
}

class TrustedKeyResolver {
  constructor(entries) {
    if (!(entries instanceof Map) || entries.size === 0) {
      throw new Error("TrustedKeyResolver requires a non-empty Map of trusted keys.");
    }
    this._trustedKeys = new Map();
    for (const [keyId, publicKeyPem] of entries) {
      if (
        typeof keyId !== "string" ||
        keyId.length === 0 ||
        typeof publicKeyPem !== "string" ||
        publicKeyPem.length === 0
      ) {
        throw new Error("Trusted key IDs and public keys must be non-empty strings.");
      }
      this._trustedKeys.set(keyId, publicKeyPem);
    }
  }

  resolvePublicKey(keyId) {
    const publicKeyPem = this._trustedKeys.get(keyId);
    if (!publicKeyPem) {
      throw new VerificationGateError(
        "UNTRUSTED_SIGNING_KEY",
        `No trusted public key is registered for keyId: ${keyId}`
      );
    }
    return publicKeyPem;
  }
}

class VerifiedAnchorService {
  constructor({ anchorClient, trustedKeyResolver, internalLedgerVerifier } = {}) {
    if (
      !anchorClient ||
      typeof anchorClient.getAnchoredAt !== "function" ||
      typeof anchorClient.anchorDigest !== "function"
    ) {
      throw new Error(
        "VerifiedAnchorService requires an `anchorClient` implementing getAnchoredAt() and anchorDigest()."
      );
    }
    if (!trustedKeyResolver || typeof trustedKeyResolver.resolvePublicKey !== "function") {
      throw new Error(
        "VerifiedAnchorService requires a `trustedKeyResolver` implementing resolvePublicKey()."
      );
    }
    if (
      !internalLedgerVerifier ||
      typeof internalLedgerVerifier.verifyRecordedEvidence !== "function"
    ) {
      throw new Error(
        "VerifiedAnchorService requires an `internalLedgerVerifier` implementing verifyRecordedEvidence()."
      );
    }
    this._anchorClient = anchorClient;
    this._trustedKeyResolver = trustedKeyResolver;
    this._internalLedgerVerifier = internalLedgerVerifier;
    this._anchorProvenance = Object.freeze(normalizeAnchorProvenance(anchorClient.provenance));
  }

  async anchorVerifiedEvidence({ evidence, metadata, ledgerEventId } = {}) {
    const metadataValidation = validateSidecarMetadataV2(metadata);
    if (!metadataValidation.ok) {
      throw new VerificationGateError(
        "INVALID_SIDECAR_METADATA",
        "Signed sidecar metadata failed schema validation."
      );
    }

    const normalizedMetadata = metadataValidation.value;
    const publicKeyPem = await this._trustedKeyResolver.resolvePublicKey(
      normalizedMetadata.keyId
    );
    const verificationResult = await verifyEvidenceWithSidecarMetadata(
      evidence,
      normalizedMetadata,
      publicKeyPem
    );
    if (verificationResult.valid !== true) {
      throw new VerificationGateError(
        "VERIFICATION_NOT_APPROVED",
        `Evidence verification failed: ${verificationResult.reason ?? "UNKNOWN"}`
      );
    }

    const digestHex = verificationResult.evidenceDigestHex;
    assertAnchorDigest(digestHex);
    assertNonEmptyString(ledgerEventId, "ledgerEventId");

    let ledgerConfirmation;
    try {
      ledgerConfirmation = await this._internalLedgerVerifier.verifyRecordedEvidence({
        ledgerEventId,
        evidenceId: normalizedMetadata.evidenceId,
        digestHex,
      });
    } catch (cause) {
      throw new InternalLedgerVerificationError("LEDGER_VERIFIER_ERROR", { cause });
    }
    const normalizedLedger = normalizeLedgerConfirmation(ledgerConfirmation, ledgerEventId);
    const digestBytes32 = `0x${digestHex}`;

    let anchoredAt;
    try {
      anchoredAt = await this._anchorClient.getAnchoredAt(digestBytes32);
    } catch (cause) {
      throw new AnchorTransactionError(digestHex, "read-anchor-state", cause);
    }
    if (isAnchored(anchoredAt)) {
      throw new AlreadyAnchoredError(digestHex, anchoredAt.toString());
    }

    let rawTransactionResult;
    try {
      rawTransactionResult = await this._anchorClient.anchorDigest(digestBytes32);
    } catch (cause) {
      if (isAlreadyAnchoredFailure(cause)) {
        throw new AlreadyAnchoredError(digestHex, null);
      }
      throw new AnchorTransactionError(digestHex, "submit-anchor-transaction", cause);
    }

    let transactionResult;
    try {
      transactionResult = normalizeTransactionResult(rawTransactionResult);
    } catch (cause) {
      throw new AnchorTransactionError(digestHex, "validate-transaction-result", cause);
    }

    return {
      digestHex,
      digestBytes32,
      transactionResult,
      anchorVerification: {
        schemaVersion: ANCHOR_VERIFICATION_SCHEMA,
        evidenceId: normalizedMetadata.evidenceId,
        digestHex,
        keyId: normalizedMetadata.keyId,
        internalLedger: normalizedLedger,
        externalLedger: { ...this._anchorProvenance, ...transactionResult },
      },
    };
  }
}

function normalizeLedgerConfirmation(value, expectedEventId) {
  if (value?.confirmed !== true) {
    throw new InternalLedgerVerificationError(
      typeof value?.reason === "string" ? value.reason : "LEDGER_NOT_CONFIRMED"
    );
  }
  if (value.eventId !== expectedEventId || !/^[0-9a-f]{64}$/.test(value.rowHash ?? "")) {
    throw new InternalLedgerVerificationError("MALFORMED_LEDGER_CONFIRMATION");
  }
  return Object.freeze({ eventId: value.eventId, rowHash: value.rowHash });
}

function normalizeAnchorProvenance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("anchorClient.provenance must be an object.");
  }
  const provider = normalizeText(value.provider, "provider");
  const network = normalizeText(value.network, "network");
  const chainId = normalizeInteger(value.chainId, "chainId", false);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value.contractAddress ?? "")) {
    throw new Error("anchorClient.provenance.contractAddress must be a 20-byte hex address.");
  }
  return { provider, network, chainId, contractAddress: value.contractAddress };
}

function normalizeTransactionResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("anchor transaction result must be an object.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(value.transactionHash ?? "")) {
    throw new Error("anchor transactionHash must be a 32-byte hex value.");
  }
  return Object.freeze({
    transactionHash: value.transactionHash,
    blockNumber: normalizeInteger(value.blockNumber, "blockNumber", true),
  });
}

function normalizeText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`anchorClient.provenance.${name} must be a non-empty string.`);
  }
  return value;
}

function normalizeInteger(value, name, allowZero) {
  let integer;
  try {
    if (typeof value === "bigint") integer = value;
    else if (typeof value === "number" && Number.isSafeInteger(value)) integer = BigInt(value);
    else if (typeof value === "string" && /^[0-9]+$/.test(value)) integer = BigInt(value);
    else throw new Error("invalid integer");
  } catch {
    throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  if (integer < (allowZero ? 0n : 1n)) {
    throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  return integer.toString();
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new VerificationGateError(
      "INVALID_LEDGER_EVENT_ID",
      `${name} must be a non-empty string.`
    );
  }
}

function isAlreadyAnchoredFailure(error) {
  const message = [error?.message, error?.reason, error?.shortMessage]
    .filter((value) => typeof value === "string")
    .join(" ");
  return message.includes("Already anchored");
}

function assertAnchorDigest(digestHex) {
  try {
    assertValidDigestHex(digestHex);
  } catch (cause) {
    throw new VerificationGateError(
      "INVALID_ANCHOR_DIGEST",
      "Verified Evidence digest must be a 64-character lowercase SHA-256 hex string.",
      { cause }
    );
  }
  if (digestHex === ZERO_DIGEST_HEX) {
    throw new VerificationGateError(
      "ZERO_ANCHOR_DIGEST",
      "Verified Evidence digest must not be the zero digest."
    );
  }
}

function isAnchored(value) {
  try {
    return BigInt(value.toString()) !== 0n;
  } catch (cause) {
    throw new VerificationGateError(
      "INVALID_ANCHOR_STATE",
      "anchorClient.getAnchoredAt() returned an invalid timestamp state.",
      { cause }
    );
  }
}

module.exports = {
  VerifiedAnchorService,
  TrustedKeyResolver,
  VerificationGateError,
  InternalLedgerVerificationError,
  AlreadyAnchoredError,
  AnchorTransactionError,
  ANCHOR_VERIFICATION_SCHEMA,
};
