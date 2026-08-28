# AWS KMS Key Management Design

## Scope

この文書は、実装済み`AwsKmsProvider`と、未deployのproduction key governanceを区別します。

## Current Implementation

`lib/aws-kms-provider.js`はAWS KMS asymmetric signing providerとして実装済みです。

| Item | Current state |
|---|---|
| KeySpec | `ECC_SECG_P256K1`を`GetPublicKey` responseで検査 |
| KeyUsage | production keyは`SIGN_VERIFY`が前提。Repositoryはkeyをprovisionしない |
| Algorithm | `ECDSA_SHA_256` |
| Message semantics | canonical EvidenceのUTF-8 bytesを`MessageType: RAW`で渡し、AWS KMSがSHA-256を一度適用 |
| Signature encoding | KMS DERを64-byte raw `r || s`へ正規化し、Verify時にDERへ戻す |
| Key identity | Sign responseのphysical key ARNを結果へ保持 |
| Private key | AWS KMS asymmetric private keyはapplicationへexportしない |

Local development用`LocalEcdsaProvider`とlocal key file workflowも残っています。local private keyはdemo専用でproduction用途ではありません。

## Current Test Boundary

自動testはinjected mock KMS clientを使い、provider logic、KeySpec、Sign/Verify parameters、encoding、cache、error handling、size limit、key ARN traceabilityを検証します。これは実AWS key、IAM/KMS policy、CloudTrail delivery、rotation、HSM operationのend-to-end保証ではありません。実機用scriptはdefault test suite外です。

## Target Production Key Governance

### Least privilege and separation of duties

- Signing workload: 指定keyの`kms:Sign`と必要な`kms:GetPublicKey`だけを許可する。
- Verification workload: 必要に応じ`kms:Verify`と`kms:GetPublicKey`だけを許可する。offline public-key verificationならKMS permissionを不要にできる。
- Key administrator: key policy、alias、enable/disable、deletion lifecycleを管理するが、Evidence signing permissionを自動的に持たない。
- Break-glass role: 通常roleから分離し、使用をalert/事後reviewする。

IAM policyとKMS key policyの両方でaccount、principal、key ARN等を制限します。Repositoryにはproduction policy/IaCはまだありません。

### Auditability

ProductionではCloudTrailの`Sign`、`Verify`、`GetPublicKey`、key policy変更、alias変更、disable/deletion eventsを保持し、次を相関します。

```text
Evidence ID → digest/signature metadata → physical KMS key ARN
            → PostgreSQL Ledger event → CloudTrail principal/time/request
```

`AwsKmsProvider`がKMS APIを呼ぶことと、CloudTrail trail、retention、log protection、alarmが構成済みであることは別です。

### Rotation and deletion

- alias切替時もsigning responseのphysical key ARNを保存する。
- 過去signatureを検証できる期間、旧public keyとmetadataを保持する。
- key disable/deletion前にEvidence retentionとverification obligationsを確認する。
- rotation、compromise、denied request、unexpected signing volumeのrunbookを用意する。

## Related Storage and Anchoring

- `S3JsonObjectStore`は実装済みだが、S3 Object Lock、Versioning、SSE-KMS、retention policyは未deployのtarget controlである。
- `PgEvidenceStore`と`PgSigningLogger`はcurrent PostgreSQL PoCである。production RDS/Aurora、role separation、backup/HAは未実装である。
- DynamoDB metadata indexはtarget/alternative architectureで、current moduleはない。
- current Web3 scriptはdigestを直接anchorし、signature verificationを証明しない。targetでは署名・検証済みdigestまたはcompact verification dataだけをanchorする。
- Evidence本文とPIIはoff-chainに保持する。

## Planned / Not Yet Implemented

- production KMS key、key policy、IAM roles、grants、multi-account designのIaC
- CloudTrail retention/correlation/alarmとseparation-of-dutiesのoperational verification
- formal rotation、disable、deletion、incident response runbook
- immutable storage deploymentとretention/legal hold procedure
- independent/offline verification packageとtrusted public-key distribution

## Security Position

Current providerはAWS KMS署名機能を実証しますが、production-ready key management systemそのものではありません。least privilege、separation of duties、CloudTrail auditability、immutable storage、operational controlsをdeploymentで検証して初めてproduction boundaryが成立します。
