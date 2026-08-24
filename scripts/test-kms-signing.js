require('dotenv').config();
const { AwsKmsProvider } = require('../lib/aws-kms-provider');

async function main() {
  console.log('=== KMS実機テスト開始 ===');
  console.log('KMS_KEY_ID:', process.env.KMS_KEY_ID);
  console.log('AWS_REGION:', process.env.AWS_REGION);

  const provider = new AwsKmsProvider({});

  console.log('\n[1] 公開鍵を取得中（KeySpec検証も実施）...');
  const publicKey = await provider.getPublicKey();
  console.log('公開鍵取得成功。長さ:', publicKey.length, 'bytes');

  const message = Buffer.from(JSON.stringify({ test: 'evidence-data', ts: Date.now() }));
  console.log('\n[2] メッセージに署名中...');
  console.log('メッセージ:', message.toString());
  const signature = await provider.signDigest(message);
  console.log('署名成功。長さ:', signature.length, 'bytes（期待値: 64）');
  console.log('署名(hex):', signature.toString('hex'));

  console.log('\n[3] 署名を検証中...');
  const isValid = await provider.verifyDigestSignature(message, signature);
  console.log('検証結果:', isValid, '（期待値: true）');

  console.log('\n[4] 改ざん検知テスト（別メッセージで検証）...');
  const tamperedMessage = Buffer.from(JSON.stringify({ test: 'TAMPERED-data', ts: Date.now() }));
  const isTamperedValid = await provider.verifyDigestSignature(tamperedMessage, signature);
  console.log('改ざんデータの検証結果:', isTamperedValid, '（期待値: false）');

  console.log('\n=== 全テスト完了 ===');
}

main().catch((err) => {
  console.error('\n❌ エラー発生:', err.message);
  console.error(err);
  process.exit(1);
});
