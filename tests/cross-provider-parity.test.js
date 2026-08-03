'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { LocalEcdsaProvider } = require('../lib/local-ecdsa-provider');
const { AwsKmsProvider } = require('../lib/aws-kms-provider');
const { getEvidenceDigestDetails } = require('../lib/signature-digest');

const sampleEvidence = {
  evidenceId: 'evd-2026-parity-001',
  schemaVersion: '1.0.0',
  eventType: 'CONSENT_GRANTED',
  subjectId: 'subject-demo-001',
  occurredAt: '2026-06-02T03:00:00Z',
};

class SpyKmsClient {
  constructor(realPrivateKey, realPublicKey) {
    this.realPrivateKey = realPrivateKey;
    this.realPublicKey = realPublicKey;
    this.lastSignInput = null;
    this.lastVerifyInput = null;
  }
  async send(command) {
    const name = command.constructor.name;
    if (name === 'GetPublicKeyCommand') {
      return { KeySpec: 'ECC_SECG_P256K1', PublicKey: Buffer.alloc(65, 0x04) };
    }
    if (name === 'SignCommand') {
      this.lastSignInput = command.input;
      const signer = crypto.createSign('sha256');
      signer.update(command.input.Message);
      return { Signature: signer.sign(this.realPrivateKey) };
    }
    if (name === 'VerifyCommand') {
      this.lastVerifyInput = command.input;
      const verifier = crypto.createVerify('sha256');
      verifier.update(command.input.Message);
      return { SignatureValid: verifier.verify(this.realPublicKey, command.input.Signature) };
    }
    throw new Error('unhandled: ' + name);
  }
}

test('Cross-provider contract parity: Local and KMS providers hash the identical message exactly once', async () => {
  const original = process.env.KMS_KEY_ID;
  process.env.KMS_KEY_ID = 'test-key';
  try {
    const { privateKey: kmsPriv, publicKey: kmsPub } =
      crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const spyClient = new SpyKmsClient(kmsPriv, kmsPub);
    const kmsProvider = new AwsKmsProvider({ kmsClient: spyClient });

    const localProvider = new LocalEcdsaProvider();
    const { privateKey: localPriv, publicKey: localPub } = localProvider.generateEcKeyPair();

    // 両者に同一のevidenceを署名させる
    await kmsProvider.signEvidence(sampleEvidence);
    const localSigned = await localProvider.signEvidence(sampleEvidence, localPriv);

    const digestDetails = await getEvidenceDigestDetails(sampleEvidence);
    const expectedMessage = Buffer.from(digestDetails.canonicalJson, 'utf8');

    // ★契約一致の核心: KMSに送られたMessageと、Localが署名対象と
    // した生データが、バイト単位で完全一致すること
    assert.deepEqual(
      spyClient.lastSignInput.Message,
      expectedMessage,
      'KMS must sign the exact same canonicalJson bytes as LocalEcdsaProvider'
    );
    assert.equal(spyClient.lastSignInput.MessageType, 'RAW');

    // Local側の署名を「KMSと同じ規則(1回だけSHA256→ECDSA)」で
    // 独立に再検証し、ハッシュ回数の不一致がないことを証明する
    const independentlyValid = crypto.verify(
      'sha256',
      expectedMessage,
      { key: localPub, dsaEncoding: 'ieee-p1363' },
      localSigned.signature
    );
    assert.equal(independentlyValid, true,
      'Local signature must validate under single-SHA256 ECDSA verification, ' +
      'proving no double-hash divergence from the KMS contract'
    );
  } finally {
    if (original === undefined) delete process.env.KMS_KEY_ID;
    else process.env.KMS_KEY_ID = original;
  }
});
