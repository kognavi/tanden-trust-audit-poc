# Architecture

## Trust Boundary

```text
Evidence → Schema → Sign → Store → Ledger
```

これはRepositoryの設計invariantです。`EvidenceProcessingService`はproduction-orientedな取り込み用application APIとしてこの順序を技術的に強制します。低レベルmoduleは既存の検証・運用用途のため個別に呼び出せます。

## Current Implementation

現在のNode.js PoCには次が実装されています。

- Evidence JSONのJSON Schema validation
- RFC 8785 JCS canonicalizationとSHA-256 digest
- local ECDSA P-256署名・検証とsidecar metadata署名・検証
- `AwsKmsProvider`によるAWS KMS `ECC_SECG_P256K1` / `ECDSA_SHA_256`署名・検証
- local filesystemおよびAmazon S3用JSON object store adapter。通常testはfake/in-memory S3 clientを使用し、実AWS testは別integration test
- `PgEvidenceStore`による署名済みversioned EvidenceのPostgreSQL保存・取得
- `PgSigningLogger`によるPostgreSQL signing event hash chainと、`AuditManager`によるsigning providerからLedgerへの記録
- `EvidenceProcessingService`によるSchema validation、署名、versioned Evidence保存、Ledger event appendの順序強制と、Store後のLedger障害に対するreconciliation情報
- `TrustAnchor.sol`とscriptによるdigest anchoring PoC

これらはlibrary、script、automated testとして存在します。production AWS環境やPostgreSQL環境が自動deployされること、IAM/KMS policy、retention、CloudTrail相関が構成済みであることを意味しません。

### Current Web3 PoC

`scripts/anchor-evidence.js`はEvidenceから計算したdigestを直接`TrustAnchor.anchor(bytes32)`へ送ります。Contractは重複anchorを拒否してtimestampを記録しますが、そのdigestがSchema validation、署名、署名検証を通過したこと自体は証明しません。Evidence本文とPIIはon-chainへ保存しません。

## Target / Reference Architecture

production-orientedなreference architectureでは、API Gateway/Lambda等のingestion、AWS KMS key policyとseparation of duties、CloudTrail/CloudWatch、S3 Versioning/Object Lock、DynamoDB metadata index、EventBridge、external anchoringを組み合わせます。DynamoDBは現在のPostgreSQL実装を置き換えた現行componentではなく、targetまたはalternative production architectureです。

Target Web3 flowでは、off-chainのTrust Boundaryを完了し、署名・検証済みであることを確認したdigestまたはcompact verification dataだけをanchorします。

## Planned / Not Yet Implemented

- API Gateway/Lambda/EventBridgeを含むAWS deploymentとIaC
- production IAM/KMS key policy、CloudTrail相関、monitoring/alarm
- S3 Object Lock/retention enforcement（S3 adapter自体は実装済み）
- DynamoDB metadata store
- production PostgreSQL provisioning、role separation、backup/HA
- 既存scriptを含む全entry pointの`EvidenceProcessingService`への移行
- 署名・検証済みdigestだけを受け付けるWeb3 anchoring flow

## Security Principles

- Evidence本文、PII、secrets、private key materialをon-chainへ保存しない
- Schema validationをskipせず、Sign/Store/Ledgerの責務を混在させない
- IAM least privilege、AWS KMS separation of duties、CloudTrail auditabilityをproduction designで維持する
- storageはcryptographic trust boundaryではなく、取得後にdigestとsignatureを検証する
