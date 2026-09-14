---
id: learning-loop-015-production-aws-audit-controls
type: learning
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md
  - .kiro/specs/loop-015-production-aws-audit-controls/design.md
  - infra/modules/production-aws-audit-controls/main.tf
  - tests/production-aws-audit-controls.test.js
supports:
  - loop-015-production-aws-audit-controls
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 015 - Production AWS Audit Controls Learning

## What became clearer

- business Evidence、AWS audit record、security detection、human notification、deployment approvalは別のplaneとして設計すると、`Evidence → Schema → Sign → Store → Ledger`を変えずにAWS auditabilityを強化できる。
- CloudTrail management eventsだけではS3 object accessを記録しない。Evidence bucketのobject data eventsを明示的に有効化する必要があるが、従量課金のためresource ARNで限定すべきである。
- KMS APIがCloudTrail対応でも、trailがKMS management eventsを除外していないこと、log deliveryとvalidationが機能すること、principal/time/requestをEvidence metadataと相関できることは別々のcontrolである。
- CloudTrail API event名はservice API名と一致しない場合がある。S3では`PutBucketLifecycleConfiguration`が`PutBucketLifecycle`、Object Lockとpublic-access changesもCloudTrail固有名を公式資料で確認する必要がある。
- audit-controlの変更検知はEvidence bucketだけでなく、CloudTrail log bucket、EventBridge rules、SNS topic自身も対象にしないとblind spotになる。
- explicit account/Region/partition inputsにすると、Terraform identity lookupなしでbucket policyのsource constraintsを構築でき、local validationをAWS credentialsから分離できる。

## Accepted trade-offs

- EventBridge direct detectionを選び、CloudWatch Logs metric filtersとunusual KMS signing-volume analyticsを後続へ送った。first baselineのIAM role、log ingestion、retention、costを減らせる。
- CloudTrail log bucketはSSE-S3とし、SSE-KMS key policy changeを避けた。KMS-backed log encryptionが必要なら別のreviewed Loopで扱う。
- Object Lockは不可逆なretention decisionが必要なため追加しなかった。Versioningとlog file validationはdetectionを改善するがdeletion preventionではない。
- same-account moduleはportfolio baselineとして再現しやすいが、privileged insider separationは不十分である。stronger production designはcross-account organization trail、log archive、SCPを検討する。
- SNS topicはsubscriptionを持たないためrepository codeだけでは人へ通知されない。subscriber identityとescalation ownershipはHuman Approval phaseに残した。

## Validation boundary

- static Node.js testsはcritical Terraform propertyの回帰を検知するが、Terraform provider schema validationやlive service behaviorを証明しない。
- 現在のWork環境にはTerraform CLIがないため、`terraform fmt -check`と`terraform validate`は未実施である。利用可能な独立環境でreview前またはmerge前に追加実行する価値がある。
- repository implementation、Terraform plan、live apply、post-deploy operational verificationを混同してはならない。
