"use strict";

const { getEvidenceDigestDetails } = require("./signature-digest");
const { validateSidecarMetadataV1 } = require("./metadata");
const {
  verifySidecarMetadataSignature,
} = require("./metadata-signature");

async function verifyEvidenceWithSidecarMetadata(
  evidence,
  metadata,
  publicKeyPem
) {
  const metadataValidation = validateSidecarMetadataV1(metadata);

  if (!metadataValidation.ok) {
    return {
      valid: false,
      reason: "INVALID_SIDECAR_METADATA",
      metadataErrors: metadataValidation.errors,
      digestMatches: false,
      signatureValid: false,
    };
  }

  const normalizedMetadata = metadataValidation.value;
  const evidenceDigestDetails = await getEvidenceDigestDetails(evidence);
  const digestMatches = evidenceDigestDetails.digestHex === normalizedMetadata.digest;

  let signatureResult;
  try {
    signatureResult = await verifySidecarMetadataSignature(
      normalizedMetadata,
      publicKeyPem
    );
  } catch (error) {
    return {
      valid: false,
      reason: "METADATA_SIGNATURE_VERIFICATION_FAILED",
      error,
      evidenceDigestHex: evidenceDigestDetails.digestHex,
      metadataDigestHex: normalizedMetadata.digest,
      digestMatches,
      signatureValid: false,
    };
  }

  const signatureValid = signatureResult.valid === true;

  if (!digestMatches) {
    return {
      valid: false,
      reason: "DIGEST_MISMATCH",
      evidenceDigestHex: evidenceDigestDetails.digestHex,
      metadataDigestHex: normalizedMetadata.digest,
      digestMatches,
      signatureValid,
      signatureResult,
    };
  }

  if (!signatureValid) {
    return {
      valid: false,
      reason: "INVALID_METADATA_SIGNATURE",
      evidenceDigestHex: evidenceDigestDetails.digestHex,
      metadataDigestHex: normalizedMetadata.digest,
      digestMatches,
      signatureValid,
      signatureResult,
    };
  }

  return {
    valid: true,
    evidenceDigestHex: evidenceDigestDetails.digestHex,
    metadataDigestHex: normalizedMetadata.digest,
    digestMatches,
    signatureValid,
    signatureResult,
  };
}

module.exports = {
  verifyEvidenceWithSidecarMetadata,
};
