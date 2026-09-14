// ── lib/metadata-signature.js の先頭に追加 ──
// 役割: 構築されたペイロードに対し、LocalEcdsaProvider + crypto で実際のダイジェスト計算・署名を行う
// パイプライン位置: metadata.js → metadata-signing.js → 3/3（暗号処理）

"use strict";

const crypto = require("node:crypto");

const { LocalEcdsaProvider } = require("./local-ecdsa-provider");
const { createMetadataSigningPayload } = require("./metadata-signing");

const defaultSignatureProvider = new LocalEcdsaProvider();

function getRawSigningMethod(signatureProvider) {
  if (typeof signatureProvider?.signRawMessage === 'function') {
    return signatureProvider.signRawMessage.bind(signatureProvider);
  }
  if (typeof signatureProvider?.signDigest === 'function') {
    return signatureProvider.signDigest.bind(signatureProvider);
  }
  throw new TypeError('Signature provider must implement signRawMessage()');
}

function getRawVerificationMethod(signatureProvider) {
  if (typeof signatureProvider?.verifyRawMessageSignature === 'function') {
    return signatureProvider.verifyRawMessageSignature.bind(signatureProvider);
  }
  if (typeof signatureProvider?.verifyDigestSignature === 'function') {
    return signatureProvider.verifyDigestSignature.bind(signatureProvider);
  }
  throw new TypeError('Signature provider must implement verifyRawMessageSignature()');
}

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
  const message = Buffer.from(digestDetails.canonicalPayload, "utf8");
  const signature = await getRawSigningMethod(signatureProvider)(message, privateKeyPem);
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

  const message = Buffer.from(digestDetails.canonicalPayload, "utf8");
  const valid = await getRawVerificationMethod(signatureProvider)(
  message,
  signature,
  publicKeyPem
);

  return {
    valid,
    digestHex: digestDetails.digestHex,
    signingTarget: digestDetails.signingTarget,
    signatureAlgorithm: metadata.signatureAlgorithm,
    signatureCurve: metadata.signatureCurve,
    signatureEncoding: metadata.signatureEncoding,
  };
}

module.exports = {
  calculateMetadataSigningDigestFromPayload,
  calculateMetadataSigningDigestHexFromPayload,
  getMetadataSigningDigestDetails,
  getRawSigningMethod,
  getRawVerificationMethod,
  signSidecarMetadata,
  verifySidecarMetadataSignature,
};
