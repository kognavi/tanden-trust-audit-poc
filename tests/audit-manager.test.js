'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AuditManager, AuditLedgerWriteError } = require('../lib/audit-manager');

function makeFakeLocalProvider({ signImpl, verifyImpl } = {}) {
  return {
    async signEvidence(evidence, privateKeyPem) {
      if (signImpl) return signImpl(evidence, privateKeyPem);
      return {
        canonicalization: 'RFC8785',
        hashAlgorithm: 'SHA-256',
        signatureAlgorithm: 'ECDSA_SHA_256',
        canonicalJson: JSON.stringify(evidence),
        digestHex: 'deadbeef',
        signature: Buffer.from('sig'),
        signatureBase64: Buffer.from('sig').toString('base64'),
      };
    },
    async verifyEvidenceSignature(evidence, signature, publicKeyPem) {
      if (verifyImpl) return verifyImpl(evidence, signature, publicKeyPem);
      return {
        canonicalization: 'RFC8785',
        hashAlgorithm: 'SHA-256',
        signatureAlgorithm: 'ECDSA_SHA_256',
        digestHex: 'deadbeef',
        valid: true,
      };
    },
  };
}

function makeFakeKmsProvider({ signImpl } = {}) {
  return {
    async signEvidence(evidence) {
      if (signImpl) return signImpl(evidence);
      return {
        canonicalization: 'RFC8785',
        hashAlgorithm: 'SHA-256',
        signatureAlgorithm: 'ECDSA_SHA_256',
        canonicalJson: JSON.stringify(evidence),
        digestHex: 'cafebabe',
        signature: Buffer.from('kms-sig'),
        signatureBase64: Buffer.from('kms-sig').toString('base64'),
        kmsKeyId: 'arn:aws:kms:ap-northeast-1:123456789012:key/abc-123',
        signingAlgorithm: 'ECDSA_SHA_256',
        signedAt: new Date().toISOString(),
      };
    },
  };
}

function makeFakePgLogger({ appendImpl } = {}) {
  const appended = [];
  return {
    appended,
    async appendEvent(event) {
      if (appendImpl) return appendImpl(event, appended);
      const row = {
        sequence: appended.length + 1,
        eventId: 'evt-' + appended.length,
        eventType: event.eventType,
        payload: event.payload,
        signature: event.signature,
        previousHash: 'prev-hash',
        rowHash: 'row-hash-' + appended.length,
        createdAt: new Date(),
      };
      appended.push(row);
      return row;
    },
  };
}

test('AuditManager requires signingProvider and pgLogger', () => {
  assert.throws(() => new AuditManager({}), /signingProvider/);
  assert.throws(() => new AuditManager({ signingProvider: {} }), /pgLogger/);
});

test('signAndRecord (local provider) appends one ledger row without embedding evidence body', async () => {
  const provider = makeFakeLocalProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-001', secretBody: 'TOP SECRET CONTENT' };

  const { signResult, ledgerRow } = await manager.signAndRecord(evidence, {
    privateKeyPem: 'FAKE_PRIVATE_KEY_PEM',
  });

  assert.equal(pgLogger.appended.length, 1);
  assert.equal(ledgerRow.eventType, 'evidence.signed');
  assert.equal(ledgerRow.payload.evidenceId, 'ev-001');
  assert.equal(ledgerRow.payload.digestHex, signResult.digestHex);
  assert.equal(ledgerRow.payload.secretBody, undefined, 'evidence body must NOT be stored in the ledger');
  assert.equal(ledgerRow.signature, signResult.signatureBase64);
});

test('signAndRecord (KMS provider) includes kmsKeyId in the ledger payload', async () => {
  const provider = makeFakeKmsProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-002' };
  const { ledgerRow } = await manager.signAndRecord(evidence);

  assert.equal(ledgerRow.payload.kmsKeyId, 'arn:aws:kms:ap-northeast-1:123456789012:key/abc-123');
});

test('signAndRecord throws AuditLedgerWriteError (with signResult attached) when ledger write fails', async () => {
  const provider = makeFakeLocalProvider();
  const pgLogger = makeFakePgLogger({
    appendImpl: async () => {
      throw new Error('connection lost');
    },
  });
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-003' };

  await assert.rejects(
    manager.signAndRecord(evidence, { privateKeyPem: 'FAKE_PEM' }),
    (err) => {
      assert.ok(err instanceof AuditLedgerWriteError);
      assert.equal(err.cause.message, 'connection lost');
      assert.ok(err.signResult, 'signResult must be attached for retry without re-signing');
      assert.equal(err.signResult.digestHex, 'deadbeef');
      return true;
    }
  );
});

test('verifyAndRecord does NOT write to the ledger on successful verification by default', async () => {
  const provider = makeFakeLocalProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-004' };
  const { verifyResult, ledgerRow } = await manager.verifyAndRecord(
    evidence,
    Buffer.from('sig'),
    { publicKeyPem: 'FAKE_PUB_PEM' }
  );

  assert.equal(verifyResult.valid, true);
  assert.equal(ledgerRow, null);
  assert.equal(pgLogger.appended.length, 0);
});

test('verifyAndRecord writes evidence.verified when recordSuccess is forced', async () => {
  const provider = makeFakeLocalProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-005' };
  const { ledgerRow } = await manager.verifyAndRecord(
    evidence,
    Buffer.from('sig'),
    { publicKeyPem: 'FAKE_PUB_PEM', recordSuccess: true }
  );

  assert.equal(ledgerRow.eventType, 'evidence.verified');
  assert.equal(pgLogger.appended.length, 1);
});

test('verifyAndRecord ALWAYS writes evidence.tamper_detected on failed verification, even without recordSuccess', async () => {
  const provider = makeFakeLocalProvider({
    verifyImpl: async () => ({
      canonicalization: 'RFC8785',
      hashAlgorithm: 'SHA-256',
      signatureAlgorithm: 'ECDSA_SHA_256',
      digestHex: 'tampered-digest',
      valid: false,
    }),
  });
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-006' };
  const { ledgerRow } = await manager.verifyAndRecord(
    evidence,
    Buffer.from('bad-sig'),
    { publicKeyPem: 'FAKE_PUB_PEM' }
  );

  assert.equal(ledgerRow.eventType, 'evidence.tamper_detected');
  assert.equal(ledgerRow.payload.valid, false);
  assert.equal(pgLogger.appended.length, 1);
});

test('verifyAndRecord throws AuditLedgerWriteError when ledger write fails after verification', async () => {
  const provider = makeFakeLocalProvider();
  const pgLogger = makeFakePgLogger({
    appendImpl: async () => {
      throw new Error('db timeout');
    },
  });
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-007' };

  await assert.rejects(
    manager.verifyAndRecord(evidence, Buffer.from('sig'), {
      publicKeyPem: 'FAKE_PUB_PEM',
      recordSuccess: true,
    }),
    (err) => {
      assert.ok(err instanceof AuditLedgerWriteError);
      assert.equal(err.cause.message, 'db timeout');
      return true;
    }
  );
});
test('verifyAndRecord records evidence.verification_error when provider throws unexpectedly', async () => {
  const provider = makeFakeLocalProvider({
    verifyImpl: async () => { throw new Error('malformed DER signature'); },
  });
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-008' };
  const { verifyResult, ledgerRow } = await manager.verifyAndRecord(
    evidence,
    Buffer.from('malformed-sig'),
    { publicKeyPem: 'FAKE_PUB_PEM' }
  );

  assert.equal(verifyResult.valid, false);
  assert.equal(ledgerRow.eventType, 'evidence.verification_error');
  assert.equal(ledgerRow.payload.error, 'malformed DER signature');
  assert.equal(pgLogger.appended.length, 1);
});

test('verifyAndRecord throws AuditLedgerWriteError when provider throws AND ledger write also fails', async () => {
  const provider = makeFakeLocalProvider({
    verifyImpl: async () => { throw new Error('malformed DER signature'); },
  });
  const pgLogger = makeFakePgLogger({
    appendImpl: async () => { throw new Error('db timeout'); },
  });
  const manager = new AuditManager({ signingProvider: provider, pgLogger });

  const evidence = { evidenceId: 'ev-009' };

  await assert.rejects(
    manager.verifyAndRecord(evidence, Buffer.from('sig'), { publicKeyPem: 'FAKE_PUB_PEM' }),
    (err) => {
      assert.ok(err instanceof AuditLedgerWriteError);
      assert.equal(err.cause.message, 'db timeout');
      return true;
    }
  );
});

test('INTEGRATION: verifyAndRecord with REAL LocalEcdsaProvider records evidence.verification_error on malformed public key PEM', async () => {
  const { LocalEcdsaProvider } = require('../lib/local-ecdsa-provider');

  const realProvider = new LocalEcdsaProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: realProvider, pgLogger });

  const { privateKey } = realProvider.generateEcKeyPair();
  const evidence = { evidenceId: 'ev-010-integration' };

  const signed = await realProvider.signEvidence(evidence, privateKey);

  const garbagePem =
    '-----BEGIN PUBLIC KEY-----\nNOT_A_REAL_KEY\n-----END PUBLIC KEY-----';

  const { verifyResult, ledgerRow } = await manager.verifyAndRecord(
    evidence,
    signed.signature,
    { publicKeyPem: garbagePem }
  );

  assert.equal(verifyResult.valid, false);
  assert.equal(ledgerRow.eventType, 'evidence.verification_error');
  assert.ok(
    ledgerRow.payload.error.includes('DECODER'),
    `Expected error message to mention DECODER, got: ${ledgerRow.payload.error}`
  );
  assert.equal(pgLogger.appended.length, 1);
});

test('INTEGRATION: verifyAndRecord with REAL LocalEcdsaProvider returns valid=false (no throw) on wrong-length signature buffer', async () => {
  const { LocalEcdsaProvider } = require('../lib/local-ecdsa-provider');

  const realProvider = new LocalEcdsaProvider();
  const pgLogger = makeFakePgLogger();
  const manager = new AuditManager({ signingProvider: realProvider, pgLogger });

  const { publicKey } = realProvider.generateEcKeyPair();
  const evidence = { evidenceId: 'ev-011-integration' };

  const malformedSignature = Buffer.from('too-short-sig');

  const { verifyResult, ledgerRow } = await manager.verifyAndRecord(
    evidence,
    malformedSignature,
    { publicKeyPem: publicKey }
  );

  assert.equal(verifyResult.valid, false);
  assert.equal(ledgerRow.eventType, 'evidence.tamper_detected');
  assert.equal(pgLogger.appended.length, 1);
});
