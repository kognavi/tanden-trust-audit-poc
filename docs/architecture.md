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
- `VerifiedAnchorService`と`TrustAnchor.sol`によるverified digest anchoring PoC

これらはlibrary、script、automated testとして存在します。production AWS環境やPostgreSQL環境が自動deployされること、IAM/KMS policy、retention、CloudTrail相関が構成済みであることを意味しません。

### Current Web3 Anchoring

Official application pathでは、`scripts/anchor-evidence.js`がEvidence、署名済みsidecar metadata、deployment trusted keyringを読みます。`VerifiedAnchorService`はvalidated metadata内のsigned `keyId`から`TrustedKeyResolver`を使ってpublic keyを解決し、既存`verifyEvidenceWithSidecarMetadata`を内部実行します。caller-supplied verification resultやpublic key overrideは受け付けません。anchor対象はverifierがEvidenceから再計算したSHA-256 digestであり、verification failure、unknown keyId、invalid/zero digestではWeb3 clientを呼びません。

このflowは既存の`Evidence → Schema → Sign → Store → Ledger`完了後に行う外部proof boundaryです。Web3 anchoring failureはStore/Ledgerをrollbackせず、独立した失敗として扱います。Contractはpermissionlessかつminimalで、zero digestとduplicateを拒否し、digestとblock timestamp相当の値だけを保持します。事前のduplicate checkはoperator feedback用であり、race conditionに対する最終判定はContract revertです。

Official application pathはunverified digestをtransactionへ送りません。一方、permissionless Contractは第三者の直接callを拒否せず、nonzero digestの初回anchorだけを保証します。Blockchainが示すのは、あるdigestが遅くとも特定blockまでにanchorされたことです。`block.timestamp`はvalidatorにより限定的に操作され得るため、厳密なtrusted timestamp authorityではありません。Contract自身はEvidence本文の真実性、署名検証、authorized signer、元Evidenceの正しさ、application approvalを保証しません。

### Access Control Decision

- A. permissionless anchoringはdecentralizationとPoC simplicityに優れる一方、arbitrary digest anchoringとfront-runningを防がない。
- B. owner/authorized roleはunauthorized anchoringをContractで防げる一方、operational key compromise、rotation、availability、administrationという新しいtrustを導入する。
- C. trusted-key-bound application verification + permissionless Contractはofficial application pathからunverified digestを送信しないが、第三者によるContract直接callとfront-running自体は防がない。

Phase 3-BではCを採用する。Contract上のanchor存在を「approved」と解釈せず、approvalはtrusted key configurationを使うoff-chain cryptographic verificationとapplication policyで判定する脅威モデルだからである。front-runningは同じdigestを先に登録してapplication transactionをduplicateにできるが、digestやEvidenceを偽造したことにはならない。運用妨害として監視・reconciliation対象にする。mainnet productionでauthorized publisher identity自体をon-chain propertyにする要件が生じた場合に限り、単純なauthorized relayerまたはowner modelを別途設計し、複雑なRBACは現段階で導入しない。

### Contract Security Review

`TrustAnchor.sol`はzero digestとduplicateをrejectし、eventのdigest/timestampをstorage writeと同じ値からemitする。外部call、Ether transfer、loopがないためreentrancy attack surfaceはなく、1 anchorあたりのgasは定数的である。mappingはanchorごとに増え続けるがunbounded iterationはなく、storage growth costはcallerが負担する。permissionless spamによるchain全体の通常のstate growthと、front-runningによるdigest単位のDoSはresidual riskである。orderingやbusiness logicは`block.timestamp`の精密性に依存しない。Proxy/upgradeabilityは導入せず、upgrade administratorやstorage layout riskを追加しない。

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

## Security Principles

- Evidence本文、PII、secrets、private key materialをon-chainへ保存しない
- Schema validationをskipせず、Sign/Store/Ledgerの責務を混在させない
- IAM least privilege、AWS KMS separation of duties、CloudTrail auditabilityをproduction designで維持する
- storageはcryptographic trust boundaryではなく、取得後にdigestとsignatureを検証する
