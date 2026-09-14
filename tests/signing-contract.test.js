'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
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
} = require('../lib/signing-contract');

test('signing contract constants describe the Local/KMS parity boundary', () => {
  assert.equal(SIGNATURE_ALGORITHM, 'ECDSA_SHA_256');
  assert.equal(HASH_ALGORITHM, 'SHA-256');
  assert.equal(SIGNATURE_CURVE, 'secp256k1');
  assert.equal(KMS_KEY_SPEC, 'ECC_SECG_P256K1');
  assert.equal(KMS_MESSAGE_TYPE, 'RAW');
  assert.equal(SIGNATURE_ENCODING, 'ieee-p1363');
  assert.equal(RAW_SIGNATURE_BYTES, 64);
  assert.equal(MAX_KMS_RAW_MESSAGE_BYTES, 4096);
});

test('assertRawMessage accepts non-empty Buffers and rejects ambiguous types', () => {
  const message = Buffer.from('raw message');
  assert.equal(assertRawMessage(message), message);
  assert.throws(() => assertRawMessage('raw message'), /must be a Buffer/);
  assert.throws(() => assertRawMessage(Buffer.alloc(0)), /must not be empty/);
  assert.throws(
    () => assertRawMessage(Buffer.alloc(5), { maxBytes: 4 }),
    /exceeds the allowed limit/
  );
});

test('assertRawSignature requires a 64-byte IEEE P1363 Buffer', () => {
  const signature = Buffer.alloc(64);
  assert.equal(assertRawSignature(signature), signature);
  assert.throws(() => assertRawSignature(Buffer.alloc(63)), /64-byte IEEE P1363 Buffer/);
  assert.throws(() => assertRawSignature('signature'), /64-byte IEEE P1363 Buffer/);
});

test('assertSecp256k1Key accepts the required curve and rejects P-256', () => {
  const secp = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const p256 = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

  assert.equal(assertSecp256k1Key(secp.privateKey, 'private').type, 'private');
  assert.equal(assertSecp256k1Key(secp.publicKey, 'public').type, 'public');
  assert.throws(
    () => assertSecp256k1Key(p256.privateKey, 'private'),
    /Expected secp256k1/
  );
});
