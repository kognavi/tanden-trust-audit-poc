# AWS KMS Signing Design

> 現行実装の詳細は`lib/aws-kms-provider.js`と`tests/aws-kms-provider.test.js`を優先し、production policyは本書のTarget節として扱います。

## Current AwsKmsProvider Implementation

`AwsKmsProvider`は実装済みです。

- `KMS_KEY_ID`をkey ID、ARN、またはaliasとして受け取る
- `GetPublicKey`で`ECC_SECG_P256K1`をfail-fast確認し、public keyをcacheする
- RFC 8785 JCS canonical EvidenceのUTF-8 bytesを`MessageType: RAW`、`ECDSA_SHA_256`でSign/Verifyする
- AWS KMSが返すDER signatureとprovider共通の64-byte raw `r || s`形式を相互変換する
- KMS responseのphysical key ARNを`kmsKeyId`として返し、key rotation時のtraceabilityを支援する
- AWS KMS RAW messageの4,096-byte上限を事前検査する

Local providerはECDSA P-256、AWS providerはsecp256k1であり、curveは異なります。共通なのはEvidence-level provider interfaceとSHA-256 signing semanticsです。

## Current Test Coverage

`tests/aws-kms-provider.test.js`はinjected mock KMS clientで、Sign/Verify、KeySpec拒否、DER/raw変換、public key cache、error、message size、physical key ARN等を検証します。`tests/cross-provider-parity.test.js`はprovider間の振る舞いを確認します。通常のautomated testは実AWS KMS、実IAM policy、CloudTrail deliveryを検証しません。実機確認用scriptはありますがdefault test suite外です。

## Target Production Design

- asymmetric `SIGN_VERIFY` keyを使用し、private key materialをAWS KMS外へ出さない
- signing roleを特定keyの`kms:Sign`と必要最小限のactionへ制限する
- verification roleとkey administratorを分離し、administratorへsigning permissionを自動付与しない
- aliasを利用する場合もphysical key ARNをEvidence metadata/Ledgerへ記録する
- CloudTrailのKMS events、IAM principal、Evidence ID、Ledger eventを相関し、retentionとalertを設定する
- key disable/deletion、policy/alias変更、rotation、incident時のverification continuityをrunbook化する

## Planned / Not Yet Implemented

- production KMS key、key policy、IAM role、multi-account boundaryのIaC
- CloudTrail log retention、correlation、alarmとseparation-of-dutiesのdeployment検証
- production key lifecycle/rotation/recovery runbook
- Schema validationからStore/Ledgerまでを単一application flowで強制すること
- S3 Object LockまたはDynamoDBとのproduction deployment integration

`AwsKmsProvider`の存在だけでproduction-ready、non-repudiation、regulatory complianceを主張してはいけません。
