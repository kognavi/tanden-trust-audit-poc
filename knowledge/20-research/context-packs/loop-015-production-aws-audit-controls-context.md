---
id: context-pack-loop-015-production-aws-audit-controls
type: context-pack
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - knowledge/00-inbox/loop-015-production-aws-audit-controls.md
  - AGENTS.md
  - infra/AGENTS.md
  - docs/module-registry.md
  - docs/architecture.md
  - docs/aws-reference-architecture.md
  - docs/aws-kms-key-management-design.md
  - docs/threat-model.md
  - docs/attack-scenarios.md
  - docs/cost-guardrails.md
  - infra/modules/kms-signing/main.tf
  - infra/modules/s3-worm/main.tf
  - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html
  - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html
  - https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html
  - https://docs.aws.amazon.com/kms/latest/developerguide/logging-using-cloudtrail.html
supports:
  - loop-015-production-aws-audit-controls
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: loop-015-production-aws-audit-controls

## Intent

production-oriented AWS audit control planeを、review可能かつ未適用のTerraform、local regression tests、運用runbookとして定義する。CloudTrailでAWS API activityとEvidence object accessを記録・保護し、security-sensitiveなCloudTrail、KMS、S3、IAM変更をEventBridgeからSNS notification boundaryへ送る。live AWS resource mutationは別のHuman Approval phaseに残す。

Source inbox: `knowledge/00-inbox/loop-015-production-aws-audit-controls.md`

## Current Implementation Truth

- Application trust boundaryは`EvidenceProcessingService`が`Evidence → Schema → Sign → Store → Ledger`の順序で強制する。AWS audit control planeはこの順序を変更してはならない。
- `AwsKmsProvider`はphysical KMS key ARNを署名結果へ保持し、KMS `Sign` / `Verify`を実行できる。ただしCloudTrail trail、retention、alertingが構成済みであることは保証しない。
- `S3JsonObjectStore`はconditional writeを実装し、`infra/modules/s3-worm/`はVersioning / Object Lock / bucket policyのTerraformを持つ。ただし現行repoはproduction deploymentやretention operationを証明しない。
- `PgEvidenceStore`と`PgSigningLogger`はEvidence metadataとhash-chain Ledgerを保持するが、CloudTrail control planeを置き換えない。逆にCloudTrailもbusiness EvidenceやLedgerを置き換えない。
- `infra/modules/kms-signing/`にはsigner、verifier、key administratorのseparation-of-duties modelがあるが、production principal assignment、KMS policy deployment、operational verificationは未実施である。
- `docs/aws-reference-architecture.md`はCloudTrail、CloudWatch、AWS Config、Security Hub、GuardDuty、IAM Access Analyzerをtargetとするが、CloudTrail trail、data selector、alertingを実装するTerraform moduleはない。
- default CIはlocal-onlyで、AWS credentialsを要求せず、real AWS APIを呼ばない。Terraform CLIも現在のWork環境には存在しない。
- `infra/terraform-github-oidc-s3.tf`はmanual S3 integration用であり、production audit log planeではない。このLoopでは変更しない。

## Threat / Risk Addressed

- CloudTrailが停止・削除・selector変更され、以後の管理操作が記録されない。
- Evidence bucketへのobject-level read/write/delete attemptがmanagement eventsだけでは追跡できない。
- KMS key disable/deletion scheduling、key policy/grant変更により署名または過去検証の信頼性が損なわれる。
- Evidence bucket policy、public-access block、Versioning、Object Lock、lifecycleが変更され、保持・機密性・完全性が弱まる。
- IAM policy/role変更で単一principalに過大権限が集まり、separation of dutiesが崩れる。
- CloudTrail log自体が変更・削除されてもlog file integrity validationがなく、検出可能性が低い。
- audit logging対象を無制限にするとCloudTrail data-event costとsensitive metadata exposureが増える。

## AWS Official Baseline

- AWSはmulti-Region trailを推奨し、CloudTrail log file integrity validationで配信後のlog変更・削除・欠落を検証できるとしている。
- CloudTrail trailは既定でmanagement eventsを記録するがdata eventsは記録しないため、Evidence S3 object accessはresource-scoped data selectorが必要である。
- AWS KMS API callsはCloudTrail eventとして記録される。KMS management event exclusionを設定しないことが重要である。
- S3 data eventsは追加料金対象であるため、対象をEvidence bucket object ARNへ限定する。
- SSE-KMSでCloudTrail logsを暗号化するには別KMS key policyが必要になる。このLoopではKMS changeを避け、SSE-S3 baselineを採用候補とする。

## Candidate Design Direction

- `infra/modules/production-aws-audit-controls/`を追加し、既存Evidence bucket ARNを入力として参照する。既存Evidence bucket、signing key、IAM principalは作成・変更しない。
- dedicated CloudTrail log bucketはVersioning、SSE-S3、BucketOwnerEnforced、public-access block、TLS-only deny、CloudTrail source ARN/account条件付きdelivery policy、bounded lifecycle retentionを持つ。`force_destroy`は使用しない。
- CloudTrail trailはmulti-Region、global service events、log file validation、all read/write management events、KMS management events exclusionなし、Evidence bucketだけのS3 object data eventsを持つ。
- detectionはCloudWatch Logs metric filtersではなくEventBridge rulesを第一候補とする。これによりCloudTrail-to-CloudWatch IAM roleとlog ingestion retentionをこのLoopから外し、control-plane dependencyと費用を抑える。
- EventBridge rulesはCloudTrail tamper、KMS lifecycle/policy/grant、Evidence/log S3 bucket control、account-wide IAM privilege-policy change、EventBridge/SNS notification-path changeを分類し、SNS topicへ送る。
- SNS subscription、email、chat endpointは作らない。topic ARNをoutputし、通知先追加をHuman Approval phaseに残す。
- local testsはTerraform text contractを検査し、critical propertyの削除やscope拡大を検知する。Terraform CLIが利用可能な環境では`terraform fmt -check`とAWS backend/APIを使わない`terraform validate`を追加で実施する。

## Resolved Scope Decisions

- EventBridge direct detectionを採用し、CloudWatch Logs metric filterとunusual signing-volume analyticsは後続Loopへ送る。
- CloudTrail log bucketのObject Lockは、retention/legal requirementとrecovery procedureが未承認のため追加しない。Versioning、log validation、no-force-destroy、alertingをbaselineとし、immutable cross-account archiveをresidual riskとして明記する。
- IAM policy-change alertsはaccount-wide event detectionとするが、IAM role/policy自体は変更しない。
- CloudTrail log encryptionはSSE-S3とし、新規KMS encryption key/key policyを作らない。
- AWS Config、Security Hub、GuardDuty、Organizations/SCP、CloudTrail Lakeはaccount-wide prerequisite、cost、運用範囲が大きいためnon-goalとする。

## Repository Rules

- `AGENTS.md` and `infra/AGENTS.md` must be read before implementation.
- code / tests / module registry remain current implementation truth.
- Terraform remains the infrastructure source of truth; CDK or parallel IaC is not added.

## Related Files

- `docs/architecture.md`: current/target boundary and explicit non-deployment status.
- `docs/aws-reference-architecture.md`: target AWS audit, monitoring, retention, and alert catalog.
- `docs/aws-kms-key-management-design.md`: KMS/CloudTrail correlation and separation-of-duties target.
- `docs/threat-model.md`: S3, IAM, privileged insider, retention residual risks.
- `docs/attack-scenarios.md`: recommended S3, KMS, CloudTrail, IAM alerts.
- `docs/cost-guardrails.md`: Local-first, manual-only AWS usage, recurring-cost approval.
- `infra/modules/kms-signing/`: existing KMS key and role separation code; input context only, no changes planned.
- `infra/modules/s3-worm/`: existing Evidence retention module; distinct from the new CloudTrail log bucket.
- `infra/environments/poc/main.tf`: existing KMS PoC root; not wired to the new production audit module in this Loop.

## Extracted Constraints

- Preserve `Evidence → Schema → Sign → Store → Ledger` without new reverse dependency.
- Keep Local-first / AWS-on-demand; tests must require no AWS credentials or network.
- Do not perform `terraform apply`, deploy, import, destroy, state manipulation, or any live AWS API call.
- Do not modify live IAM, KMS, S3, CloudTrail, EventBridge, SNS, retention, or account-level security services.
- Do not modify existing KMS key policy, Evidence bucket policy, Object Lock configuration, IAM principal, or signing API.
- Do not store raw prompts, raw responses, secrets, credentials, Evidence bodies, or unnecessary PII in audit alerts or repository artifacts.
- Keep audit log storage separate from the Evidence store and PostgreSQL Ledger.
- Context Pack is supporting context, not a replacement for code/tests/module registry.
- Security Reviewer is mandatory because Terraform defines security-sensitive detective and log-protection controls.
- Builder → Reviewer → Security Reviewer → Verification order must be preserved.
- Merge, deploy, AWS apply, IAM/KMS/retention changes, notification subscriptions, and destructive operations require explicit Human Approval.

## Validation Targets

- New module is not instantiated by an existing environment and cannot make live changes during tests.
- CloudTrail is multi-Region, includes global services, enables log file validation, records all management events, and scopes S3 data events to the configured Evidence bucket.
- Log bucket uses Versioning, SSE-S3, BucketOwnerEnforced, public-access block, TLS-only deny, constrained CloudTrail delivery, lifecycle retention, and no `force_destroy`.
- EventBridge patterns cover CloudTrail tamper, KMS security administration, Evidence/log S3 controls, IAM privilege-policy changes, and notification-path changes without embedding Evidence content.
- SNS topic has no subscriptions and permits publish only from the created EventBridge rules.
- inputs reject malformed Evidence bucket ARN and unsafe retention values where Terraform validation can do so.
- outputs expose trail, log bucket, notification topic, and event rule identifiers without secrets.
- docs distinguish implemented Terraform from deployed/verified controls and provide human-approved deployment/rollback verification steps without executing them.
- focused local tests, `npm run check:structure`, implementation conformance, independent Reviewer, and independent Security Reviewer pass before Verification Evidence.

## Review Checklist

- [x] Related files are actually relevant to the Inbox intent.
- [x] No security-sensitive context is missing for the scoped control plane.
- [x] Existing target documents are not treated as deployed implementation truth.
- [x] Scope is narrow enough for a Terraform module, local tests, and runbook without AWS mutation.
