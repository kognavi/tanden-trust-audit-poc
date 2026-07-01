"use strict";

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const METADATA_SCHEMA_VERSION = "tanden.trust.metadata.v1";
const CANONICALIZATION = "JCS";
const DIGEST_ALGORITHM = "SHA-256";
const DIGEST_ENCODING = "hex";
const SIGNATURE_ALGORITHM = "ECDSA_P256_SHA256";
const SIGNATURE_ENCODING = "base64url";
const SIGNING_TARGET = "metadata_without_signature";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj, key, errors) {
  const value = obj[key];

  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${key} must be a non-empty string`);
    return undefined;
  }

  return value;
}

function validateSidecarMetadataV1(value) {
  const errors = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ["metadata must be an object"],
    };
  }

  const schemaVersion = requireString(value, "schemaVersion", errors);
  const evidenceId = requireString(value, "evidenceId", errors);
  const evidenceKey = requireString(value, "evidenceKey", errors);
  const canonicalization = requireString(value, "canonicalization", errors);
  const digestAlgorithm = requireString(value, "digestAlgorithm", errors);
  const digestEncoding = requireString(value, "digestEncoding", errors);
  const digest = requireString(value, "digest", errors);
  const signatureAlgorithm = requireString(value, "signatureAlgorithm", errors);
  const signatureEncoding = requireString(value, "signatureEncoding", errors);
  const signature = requireString(value, "signature", errors);
  const keyId = requireString(value, "keyId", errors);
  const publicKeyRef = requireString(value, "publicKeyRef", errors);
  const signedAt = requireString(value, "signedAt", errors);
  const signingTarget = requireString(value, "signingTarget", errors);

  const evidenceVersionId = value.evidenceVersionId;

  if (
    evidenceVersionId !== undefined &&
    (typeof evidenceVersionId !== "string" || evidenceVersionId.length === 0)
  ) {
    errors.push("evidenceVersionId must be a non-empty string when provided");
  }

  if (schemaVersion !== undefined && schemaVersion !== METADATA_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${METADATA_SCHEMA_VERSION}`);
  }

  if (canonicalization !== undefined && canonicalization !== CANONICALIZATION) {
    errors.push(`canonicalization must be ${CANONICALIZATION}`);
  }

  if (digestAlgorithm !== undefined && digestAlgorithm !== DIGEST_ALGORITHM) {
    errors.push(`digestAlgorithm must be ${DIGEST_ALGORITHM}`);
  }

  if (digestEncoding !== undefined && digestEncoding !== DIGEST_ENCODING) {
    errors.push(`digestEncoding must be ${DIGEST_ENCODING}`);
  }

  if (digest !== undefined && !SHA256_HEX_REGEX.test(digest)) {
    errors.push("digest must be a lowercase SHA-256 hex string");
  }

  if (
    signatureAlgorithm !== undefined &&
    signatureAlgorithm !== SIGNATURE_ALGORITHM
  ) {
    errors.push(`signatureAlgorithm must be ${SIGNATURE_ALGORITHM}`);
  }

  if (
    signatureEncoding !== undefined &&
    signatureEncoding !== SIGNATURE_ENCODING
  ) {
    errors.push(`signatureEncoding must be ${SIGNATURE_ENCODING}`);
  }

  if (signingTarget !== undefined && signingTarget !== SIGNING_TARGET) {
    errors.push(`signingTarget must be ${SIGNING_TARGET}`);
  }

  if (signedAt !== undefined && !ISO_DATE_REGEX.test(signedAt)) {
    errors.push("signedAt must be an ISO-8601 UTC timestamp");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: {
      schemaVersion,
      evidenceId,
      evidenceKey,
      ...(typeof evidenceVersionId === "string" ? { evidenceVersionId } : {}),
      canonicalization,
      digestAlgorithm,
      digestEncoding,
      digest,
      signatureAlgorithm,
      signatureEncoding,
      signature,
      keyId,
      publicKeyRef,
      signedAt,
      signingTarget,
    },
  };
}

module.exports = {
  METADATA_SCHEMA_VERSION,
  CANONICALIZATION,
  DIGEST_ALGORITHM,
  DIGEST_ENCODING,
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  SIGNING_TARGET,
  validateSidecarMetadataV1,
};
