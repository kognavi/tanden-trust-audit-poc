"use strict";

const { validateSidecarMetadataV2 } = require("./metadata");
const { assertValidDigestHex } = require("./pg-evidence-store");
const {
  verifyEvidenceWithSidecarMetadata,
} = require("./sidecar-verifier");

const ZERO_DIGEST_HEX = "0".repeat(64);

class VerificationGateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "VerificationGateError";
    this.code = code;
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
  constructor(digestHex, cause) {
    super(
      "Verified digest could not be anchored. Off-chain Evidence, Store, and Ledger state was not rolled back.",
      { cause }
    );
    this.name = "AnchorTransactionError";
    this.code = "WEB3_ANCHOR_FAILED";
    this.digestHex = digestHex;
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
  constructor({ anchorClient, trustedKeyResolver } = {}) {
    if (
      !anchorClient ||
      typeof anchorClient.getAnchoredAt !== "function" ||
      typeof anchorClient.anchorDigest !== "function"
    ) {
      throw new Error(
        "VerifiedAnchorService requires an `anchorClient` implementing getAnchoredAt() and anchorDigest()."
      );
    }
    if (
      !trustedKeyResolver ||
      typeof trustedKeyResolver.resolvePublicKey !== "function"
    ) {
      throw new Error(
        "VerifiedAnchorService requires a `trustedKeyResolver` implementing resolvePublicKey()."
      );
    }
    this._anchorClient = anchorClient;
    this._trustedKeyResolver = trustedKeyResolver;
  }

  async anchorVerifiedEvidence({ evidence, metadata } = {}) {
    const metadataValidation = validateSidecarMetadataV2(metadata);
    if (!metadataValidation.ok) {
      throw new VerificationGateError(
        "INVALID_SIDECAR_METADATA",
        "Signed sidecar metadata failed schema validation."
      );
    }

    const publicKeyPem = await this._trustedKeyResolver.resolvePublicKey(
      metadataValidation.value.keyId
    );
    const verificationResult = await verifyEvidenceWithSidecarMetadata(
      evidence,
      metadata,
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
    const digestBytes32 = `0x${digestHex}`;

    let anchoredAt;
    try {
      anchoredAt = await this._anchorClient.getAnchoredAt(digestBytes32);
    } catch (cause) {
      throw new AnchorTransactionError(digestHex, cause);
    }
    if (isAnchored(anchoredAt)) {
      throw new AlreadyAnchoredError(digestHex, anchoredAt.toString());
    }

    try {
      const transactionResult = await this._anchorClient.anchorDigest(
        digestBytes32
      );
      return { digestHex, digestBytes32, transactionResult };
    } catch (cause) {
      if (isAlreadyAnchoredFailure(cause)) {
        throw new AlreadyAnchoredError(digestHex, null);
      }
      throw new AnchorTransactionError(digestHex, cause);
    }
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
  AlreadyAnchoredError,
  AnchorTransactionError,
};
