# AWS Architecture for Evidence Integrity Verification

## Scope

この文書は、実装済みAWS adapterとproduction-oriented targetを分離して示します。Repositoryはproduction AWS stackをdeployしません。

## Current Implementation

- `AwsKmsProvider`: AWS SDK for JavaScript v3を使い、`ECC_SECG_P256K1` keyを`GetPublicKey`で確認して、canonical Evidence bytesを`MessageType: RAW` / `ECDSA_SHA_256`でSign/Verifyする。KMS DER signatureは64-byte raw形式へ変換してprovider interfaceを揃える。
- `S3JsonObjectStore`: JSON objectのPut/Get、key/bucket validation、missing/invalid JSON error normalization、conditional writeを提供する。
- S3 test: fake clientによるunit/E2Eと、明示的に実行するreal AWS integration testがある。
- PostgreSQL: `PgEvidenceStore`が署名済みversioned Evidenceを保存し、`PgSigningLogger`がsigning event hash chainを保持する。`AuditManager`はsign/verify結果をLedgerへ記録する。

これらはPoC moduleです。AWS accountへのdeployment、production IAM/KMS policy、CloudTrail設定、S3 Object Lock、managed PostgreSQLは含みません。

## Target / Reference Architecture

```text
Client → API Gateway / Lambda → Schema → AWS KMS Sign
                                      → S3 Versioning / Object Lock
                                      → DynamoDB metadata or hardened PostgreSQL
                                      → CloudTrail / CloudWatch / EventBridge
                                      → verified digest external anchoring
```

- DynamoDBはmetadata/query用のtargetまたはalternative architectureであり、current implementationではない。
- Amazon S3はcurrent adapterがあるが、Versioning/Object Lock/SSE-KMS/retention policyはtarget controlである。
- PostgreSQL current modulesは存在するが、Amazon RDS/Aurora provisioning、least-privilege DB roles、backup/HAはtarget operationである。
- AWS KMS key administrationとsigning roleのseparation、CloudTrail retention/correlation/alarmはproduction designである。

## Planned / Not Yet Implemented

- API Gateway、Lambda、EventBridge、DynamoDBのruntime/IaC
- production KMS key/key policy/IAM roleとrotation procedure
- CloudTrail/CloudWatchの構成、相関、alert
- S3 Object Lockを有効にしたbucketとretention運用
- RDS/Aurora PostgreSQL deploymentとDB role separation
- Merkle batchingまたは署名・検証済みdigest anchoring

## Security Requirements

- 入力をSchema validationしてから署名する。
- `kms:Sign`を特定keyとtrusted workloadへ限定し、key administratorに自動付与しない。
- Evidence本文とPIIをon-chainへ保存しない。
- S3/DynamoDB/PostgreSQLから取得したdataを信頼せず、digestとsignatureを再検証する。
- CloudTrail、Semgrep、CodeQL、Dependabot、dependency-cruiser、Madge、automated testsを弱体化しない。
