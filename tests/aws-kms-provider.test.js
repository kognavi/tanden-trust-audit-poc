'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AwsKmsProvider,
  decodeDerSignatureToRaw,
} = require('../lib/aws-kms-provider');

class FakeKmsClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.calls = [];
  }
  async send(command) {
    this.calls.push(command);
    const name = command.constructor.name;
    const handler = this.handlers[name];
    if (!handler) {
      throw new Error('FakeKmsClient: no handler for ' + name);
    }
    return typeof handler === 'function' ? handler(command) : handler;
  }
}

async function withKmsKeyId(keyId, fn) {
  const original = process.env.KMS_KEY_ID;
  if (keyId === undefined) { delete process.env.KMS_KEY_ID; } else { process.env.KMS_KEY_ID = keyId; }
  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.KMS_KEY_ID;
    } else {
      process.env.KMS_KEY_ID = original;
    }
  }
}

function derInt(bytes) {
  return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes]);
}

function derSeq(content) {
  let lenBytes;
  if (content.length < 0x80) {
    lenBytes = Buffer.from([content.length]);
  } else if (content.length <= 0xff) {
    lenBytes = Buffer.from([0x81, content.length]);
  } else {
    lenBytes = Buffer.from([0x82, (content.length >> 8) & 0xff, content.length & 0xff]);
  }
  return Buffer.concat([Buffer.from([0x30]), lenBytes, content]);
}

function derSig(r, s) {
  return derSeq(Buffer.concat([derInt(r), derInt(s)]));
}

// ★新規: KeySpec検証をパスさせるための共通ヘルパー
// signDigest/verifyDigestSignature/getPublicKeyは内部で
// _ensureKeySpecVerified() を呼ぶため、正常系テストでは
// GetPublicKeyCommand のハンドラが必須になる。
function validKeySpecHandler(publicKey = Buffer.alloc(65, 0x04)) {
  return () => ({ KeySpec: 'ECC_SECG_P256K1', PublicKey: publicKey });
}

test('decodeDerSignatureToRaw: no padding', () => {
  const r = Buffer.alloc(32, 0x11);
  const s = Buffer.alloc(32, 0x22);
  const raw = decodeDerSignatureToRaw(derSig(r, s));
  assert.equal(raw.length, 64);
  assert.deepEqual(raw.slice(0, 32), r);
  assert.deepEqual(raw.slice(32, 64), s);
});

test('decodeDerSignatureToRaw: r has leading zero padding', () => {
  const r = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(32, 0xaa)]);
  const s = Buffer.alloc(32, 0x22);
  const raw = decodeDerSignatureToRaw(derSig(r, s));
  assert.equal(raw.length, 64);
  assert.deepEqual(raw.slice(0, 32), Buffer.alloc(32, 0xaa));
});

test('decodeDerSignatureToRaw: r shorter than 32 bytes gets left-padded', () => {
  const r = Buffer.alloc(20, 0x33);
  const s = Buffer.alloc(32, 0x22);
  const raw = decodeDerSignatureToRaw(derSig(r, s));
  assert.equal(raw.length, 64);
  assert.deepEqual(raw.slice(0, 12), Buffer.alloc(12, 0x00));
  assert.deepEqual(raw.slice(12, 32), r);
});

test('decodeDerSignatureToRaw: long-form length (0x81)', () => {
  const r = Buffer.alloc(32, 0x44);
  const s = Buffer.alloc(32, 0x55);
  const raw = decodeDerSignatureToRaw(derSig(r, s));
  assert.equal(raw.length, 64);
});

test('decodeDerSignatureToRaw: throws on malformed input', () => {
  assert.throws(() => decodeDerSignatureToRaw(Buffer.from([0x00, 0x01])));
});

test('AwsKmsProvider: throws if KMS_KEY_ID not set', async () => {
  await withKmsKeyId(undefined, async () => {
    assert.throws(() => new AwsKmsProvider(), /KMS_KEY_ID/);
  });
});

test('AwsKmsProvider: accepts injected kmsClient', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient();
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    assert.ok(provider);
  });
});

test('signDigest: calls SignCommand and decodes DER', async () => {
  await withKmsKeyId('test-key', async () => {
    const r = Buffer.alloc(32, 0x01);
    const s = Buffer.alloc(32, 0x02);
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(), // ★変更: KeySpec検証を通すため追加
      SignCommand: () => ({ Signature: derSig(r, s) }),
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    const raw = await provider.signDigest(Buffer.alloc(32));
    assert.equal(raw.length, 64);
  });
});

test('signDigest: propagates KMS errors', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(), // ★変更: KeySpec検証を通すため追加
      SignCommand: () => { throw new Error('KMS unavailable'); },
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    await assert.rejects(
      () => provider.signDigest(Buffer.alloc(32)),
      /KMS unavailable/
    );

    // ★TD-002: cause chainが正しく保持されているか検証
    try {
      await provider.signDigest(Buffer.alloc(32));
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.cause, 'error.cause should be set');
      assert.equal(err.cause.message, 'KMS unavailable');
    }
  });
});

test('verifyDigestSignature: returns false when KMS reports invalid signature', async () => {
  await withKmsKeyId('test-key', async () => {
    const invalidSigError = new Error('Signature verification failed');
    invalidSigError.name = 'KMSInvalidSignatureException';

    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(),
      VerifyCommand: () => { throw invalidSigError; },
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });

    const valid = await provider.verifyDigestSignature(Buffer.alloc(32), Buffer.alloc(64));
    assert.equal(valid, false);
  });
});

test('verifyDigestSignature: propagates genuine KMS service errors', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(),
      VerifyCommand: () => { throw new Error('KMS unavailable'); },
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });

    await assert.rejects(
      () => provider.verifyDigestSignature(Buffer.alloc(32), Buffer.alloc(64)),
      /KMS Verify operation failed/
    );
  });
});

test('verifyDigestSignature: returns true for a valid signature', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(),
      VerifyCommand: () => ({ SignatureValid: true }),
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });

    const valid = await provider.verifyDigestSignature(Buffer.alloc(32), Buffer.alloc(64));
    assert.equal(valid, true);
  });
});

// ★TD-001 — 想定外のKeySpecなら即座にthrowすることを検証
test('_ensureKeySpecVerified: throws on unsupported KeySpec (TD-001)', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: () => ({
        KeySpec: 'ECC_NIST_P384', // 想定外のカーブ
        PublicKey: Buffer.alloc(65, 0x04),
      }),
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    await assert.rejects(
      () => provider.getPublicKey(),
      /Unsupported KMS KeySpec: ECC_NIST_P384/
    );
  });
});

test('getPublicKey: returns public key bytes', async () => {
  await withKmsKeyId('test-key', async () => {
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: validKeySpecHandler(Buffer.alloc(65, 0x04)),
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    const pub = await provider.getPublicKey();
    assert.equal(pub.length, 65);
  });
});

// ★新規: TD-003 — GetPublicKeyCommandは1回だけ呼ばれ、以降はキャッシュを返すことを検証
test('_ensureKeySpecVerified: caches result across multiple calls (TD-003)', async () => {
  await withKmsKeyId('test-key', async () => {
    let callCount = 0;
    const fakeClient = new FakeKmsClient({
      GetPublicKeyCommand: () => {
        callCount += 1;
        return { KeySpec: 'ECC_SECG_P256K1', PublicKey: Buffer.alloc(65, 0x04) };
      },
    });
    const provider = new AwsKmsProvider({ kmsClient: fakeClient });
    await provider.getPublicKey();
    await provider.getPublicKey();
    assert.equal(callCount, 1, 'GetPublicKeyCommand should only be called once (cached)');
  });
});
