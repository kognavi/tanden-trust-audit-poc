"use strict";

const { validateSidecarMetadataV1 } = require("./metadata");

let canonicalizeFunctionPromise;

function loadCanonicalizeFunction() {
  if (!canonicalizeFunctionPromise) {
    canonicalizeFunctionPromise = import("canonicalize").then((module) => {
      const canonicalize = module.default || module;

      if (typeof canonicalize !== "function") {
        throw new Error("Failed to load canonicalize function");
      }

      return canonicalize;
    });
  }

  return canonicalizeFunctionPromise;
}

function omitSignature(metadata) {
  const { signature, ...metadataWithoutSignature } = metadata;
  return metadataWithoutSignature;
}

async function createMetadataSigningPayload(metadata) {
  const validation = validateSidecarMetadataV1(metadata);

  if (!validation.ok) {
    const error = new Error("Invalid sidecar metadata");
    error.code = "INVALID_SIDECAR_METADATA";
    error.validationErrors = validation.errors;
    throw error;
  }

  const metadataWithoutSignature = omitSignature(validation.value);
  const canonicalize = await loadCanonicalizeFunction();
  const canonicalPayload = canonicalize(metadataWithoutSignature);

  if (typeof canonicalPayload !== "string") {
    const error = new Error("Failed to canonicalize sidecar metadata");
    error.code = "METADATA_CANONICALIZATION_FAILED";
    throw error;
  }

  return canonicalPayload;
}

module.exports = {
  omitSignature,
  createMetadataSigningPayload,
};
