'use strict';

const crypto = require('node:crypto');

const SIGNATURE_ALGORITHM = 'ECDSA_SHA_256';
const HASH_ALGORITHM = 'SHA-256';
const SIGNATURE_CURVE = 'secp256k1';
const KMS_KEY_SPEC = 'ECC_SECG_P256K1';
const KMS_MESSAGE_TYPE = 'RAW';
const SIGNATURE_ENCODING = 'ieee-p1363';
const RAW_SIGNATURE_BYTES = 64;
const MAX_KMS_RAW_MESSAGE_BYTES = 4096;

function assertRawMessage(message, { maxBytes } = {}) {
  if (!Buffer.isBuffer(message)) {
    throw new TypeError('Raw signing message must be a Buffer');
  }
  if (message.length === 0) {
    throw new Error('Raw signing message must not be empty');
  }
  if (maxBytes !== undefined && message.length > maxBytes) {
    throw new Error(
      `Raw signing message (${message.length} bytes) exceeds the allowed limit (${maxBytes} bytes)`
    );
  }
  return message;
}

function assertRawSignature(signature) {
  if (!Buffer.isBuffer(signature) || signature.length !== RAW_SIGNATURE_BYTES) {
    const actual = Buffer.isBuffer(signature) ? `${signature.length}-byte Buffer` : typeof signature;
    throw new TypeError(
      `Raw signature must be a ${RAW_SIGNATURE_BYTES}-byte IEEE P1363 Buffer; received ${actual}`
    );
  }
  return signature;
}

function assertSecp256k1Key(key, expectedType) {
  if (!['private', 'public'].includes(expectedType)) {
    throw new Error(`Unsupported key type contract: ${expectedType}`);
  }

  let keyObject;
  try {
    keyObject = key instanceof crypto.KeyObject
      ? key
      : expectedType === 'private'
        ? crypto.createPrivateKey(key)
        : crypto.createPublicKey(key);
  } catch (error) {
    throw new Error(
      `Invalid ${expectedType} key for ${SIGNATURE_CURVE} signing: ${error.message}`,
      { cause: error }
    );
  }

  if (keyObject.type !== expectedType) {
    throw new Error(`Expected a ${expectedType} key, received ${keyObject.type}`);
  }
  if (
    keyObject.asymmetricKeyType !== 'ec' ||
    keyObject.asymmetricKeyDetails?.namedCurve !== SIGNATURE_CURVE
  ) {
    const actualCurve = keyObject.asymmetricKeyDetails?.namedCurve || keyObject.asymmetricKeyType || 'unknown';
    throw new Error(
      `Unsupported signing key curve: ${actualCurve}. Expected ${SIGNATURE_CURVE}`
    );
  }

  return keyObject;
}

module.exports = {
  SIGNATURE_ALGORITHM,
  HASH_ALGORITHM,
  SIGNATURE_CURVE,
  KMS_KEY_SPEC,
  KMS_MESSAGE_TYPE,
  SIGNATURE_ENCODING,
  RAW_SIGNATURE_BYTES,
  MAX_KMS_RAW_MESSAGE_BYTES,
  assertRawMessage,
  assertRawSignature,
  assertSecp256k1Key,
};
