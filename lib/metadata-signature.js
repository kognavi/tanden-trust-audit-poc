"use strict";

const crypto = require("node:crypto");

const { LocalEcdsaProvider } = require("./local-ecdsa-provider");
const { createMetadataSigningPayload } = require("./metadata-signing");

const defaultSignatureProvider = new LocalEcdsaProvider();

function calculateMetadataSigningDigestFromPayload(payload) {
  return crypto.createHash("sha256").update(payload, "utf8").digest();
}

function calculateMetadataSigningDigestHexFromPayload(payload) {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

async function getMetadataSigningDigestDetails(metadata) {
  const canonicalPayload = await createMetadataSigningPayload(metadata);
  const digest = calculateMetadataSigningDigestFromPayload(canonicalPayload);
  const digestHex = calculateMetadataSigningDigestHexFromPayload(canonicalPayload);

  return {
    canonicalPayload,
    digest,
    digestHex,
    digestAlgorithm: "SHA-256",
    digestEncoding: "hex",
    signingTarget: "metadata_without_signature",
  };
}

async function signSidecarMetadata(metadata, privateKeyPem, signatureProvider = defaultSignatureProvider) {
  const digestDetails = await getMetadataSigningDigestDetails(metadata);
  const signature = await signatureProvider.signDigest(digestDetails.digest, privateKeyPem);
  const signatureBase64url = signature.toString("base64url");

  return {
    ...metadata,
    signature: signatureBase64url,
  };
}

async function verifySidecarMetadataSignature(metadata, publicKeyPem, signatureProvider = defaultSignatureProvider) {
  const digestDetails = await getMetadataSigningDigestDetails(metadata);

  let signature;
  try {
    signature = Buffer.from(metadata.signature, "base64url");
  } catch {
    return {
      valid: false,
      reason: "INVALID_SIGNATURE_ENCODING",
      digestHex: digestDetails.digestHex,
      signingTarget: digestDetails.signingTarget,
    };
  }

  const valid = await signatureProvider.verifyDigestSignature(
  digestDetails.digest,
  signature,
  publicKeyPem
);

  return {
    valid,
    digestHex: digestDetails.digestHex,
    signingTarget: digestDetails.signingTarget,
    signatureAlgorithm: metadata.signatureAlgorithm,
    signatureEncoding: metadata.signatureEncoding,
  };
}

module.exports = {
  calculateMetadataSigningDigestFromPayload,
  calculateMetadataSigningDigestHexFromPayload,
  getMetadataSigningDigestDetails,
  signSidecarMetadata,
  verifySidecarMetadataSignature,
};
