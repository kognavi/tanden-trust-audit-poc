# loop-015-production-aws-audit-controls Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls`

## Purpose

AWS上のEvidence運用に必要なdetective audit controlsを、未適用のTerraform module、local regression tests、運用runbookとしてコード化する。CloudTrailでmanagement activityとEvidence S3 object accessを記録し、audit control、KMS、Evidence bucket、IAMのsecurity-sensitive変更をEventBridgeからSNS notification boundaryへ送る。live AWS変更は明示的Human Approvalまで実行しない。

## Current Implementation Truth

- `EvidenceProcessingService`が`Evidence → Schema → Sign → Store → Ledger`のapplication trust boundaryを強制する。
- `AwsKmsProvider`、`S3JsonObjectStore`、KMS signing Terraform、S3 WORM Terraformは存在するが、production CloudTrail、S3 data events、log protection、alertingは未実装・未deployである。
- `PgEvidenceStore`と`PgSigningLogger`はbusiness EvidenceのStore/Ledgerであり、AWS control-plane audit logとは別責務である。
- AWS reference architectureのCloudTrail、CloudWatch、Config、Security Hub、GuardDutyはtargetであり、deployed controlを意味しない。
- default development/CIはlocal-onlyであり、AWS credentialsとreal AWS callsを要求しない。
- Context Packはsupporting contextであり、code、tests、module registryがcurrent implementation truthである。

## Requirements

- [x] reusable Terraform moduleを`infra/modules/production-aws-audit-controls/`に追加し、既存environmentから自動instantiateしない。
- [x] moduleは既存Evidence bucket ARN、AWS account ID、home Region、partition、dedicated log bucket nameを明示的inputとして受ける。
- [x] dedicated CloudTrail log bucketはVersioning、SSE-S3、BucketOwnerEnforced、public-access block、TLS-only deny、bounded lifecycle retentionを持ち、`force_destroy`を使用しない。
- [x] log bucket policyはCloudTrail service principalのACL checkとlog deliveryだけを許可し、configured trail ARN、source account、AWSLogs account prefixへ制約する。
- [x] trailはmulti-Region、global service events、log file validation、all read/write management eventsを有効化し、KMS management eventsを除外しない。
- [x] trailはconfigured Evidence bucket object ARNだけをS3 data-event対象とし、all-bucket data event loggingを行わない。
- [x] EventBridge rulesはCloudTrail停止・削除・selector変更、KMS key lifecycle/policy/grant変更、configured Evidence bucketのpolicy/public access/Versioning/Object Lock/lifecycle変更、account-wide IAM privilege-policy変更を検知する。
- [x] EventBridge rulesは単一SNS topicへ通知し、topic policyはcreated rulesからのpublishへ制約する。
- [x] SNS subscription、email/chat endpoint、customer-managed KMS key、IAM role/policy、AWS Config、Security Hub、GuardDuty、Organizations/SCP、CloudTrail Lakeを作成しない。
- [x] Terraform variable validationはaccount ID、Region、partition、S3 ARN、bucket name、retention rangeの明白な誤設定をfail earlyにする。
- [x] module outputsはtrail ARN/name、log bucket ARN/name、SNS topic ARN、EventBridge rule ARNsを公開し、secretを含まない。
- [x] runbookはplan/apply/rollback/verificationをHuman Approval stepsとして記述し、このLoopで未実行であることを明示する。
- [x] local deterministic testsは重要control、scope、禁止resource、Human Approval boundaryをAWS credentialsなしで検査する。
- [x] existing KMS key/key policy、Evidence bucket/policy/Object Lock、IAM principal、signing API、application processing codeを変更しない。

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger` unless explicitly approved as an architecture change.
- Do not bypass schema validation, signing, storage, or ledger boundaries.
- Do not weaken security controls to make implementation easier.
- Keep Local-first / AWS-on-demand unless a reviewed requirement justifies otherwise.
- AWS audit control planeはapplication flowをobserveするだけで、Evidence、Schema、Sign、Store、Ledgerの責務を持たない。
- CloudTrailはAPI activityの記録であり、business eventのtruth、authorization、completenessを単独では証明しない。
- alertsへEvidence body、signature、credential、raw prompt/response、secret、不要なPIIを追加しない。
- `terraform apply`, deploy, import, destroy, state mutation, live IAM/KMS/S3/CloudTrail/EventBridge/SNS changeを実行しない。
- merge、notification subscription、retention decision、IAM/KMS change、destructive operationはHuman Approvalを必要とする。
- Builder → Reviewer → Security Reviewer → Verificationの順序を維持する。

## Acceptance Criteria

- [x] moduleは既存environmentから未参照で、repository testがAWS APIを呼ばない。
- [x] static testsがmulti-Region、global events、log validation、management events、KMS non-exclusion、Evidence bucket-scoped data eventsを検証する。
- [x] static testsがlog bucket protection、CloudTrail delivery constraints、no-force-destroyを検証する。
- [x] static testsが4分類のEventBridge event coverage、SNS target/policy、subscription不在を検証する。
- [x] static testsがIAM/KMS resource作成、existing module変更、AWS apply commandの追加がないことを検証する。
- [x] runbookがcurrent codeとdeployed stateを区別し、cost、residual risk、approval、post-deploy verificationを記載する。
- [x] focused testsと`npm run check:structure`がPASSする。
- [x] Terraform CLIが利用可能な環境では`terraform fmt -check`とoffline `terraform validate`を実施する。利用不能時は未実施理由をevidenceへ残す。
- [x] independent Reviewerとindependent Security ReviewerがPASSする。

## Open Questions

None.

## Review Gate

This specification is ready for independent validation against the Context Pack, current code/tests/module registry, AWS audit trust boundaries, and cost guardrails. It authorizes repository-only design/code/test changes, not merge, deploy, AWS apply, IAM/KMS change, retention change, notification subscription, or destructive operation.
