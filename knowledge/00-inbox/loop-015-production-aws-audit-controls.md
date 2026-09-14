---
id: loop-015-production-aws-audit-controls
type: idea
status: inbox
created: 2026-09-14
updated: 2026-09-14
source:
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
supports:
  - loop-014-kms-signing-api-contract-hardening
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 015 - Production AWS Audit Controls

## Intent

AWS上のEvidence運用について、API activityの記録、audit logの改ざん検知、Evidence object accessの追跡、security-sensitive control-plane変更の検知と通知を、review可能なTerraformと運用文書として定義する。設計・コードはlive AWS resource mutationから分離し、このLoopではapplyやdeployを行わない。

## Current concern

- `AwsKmsProvider`、`S3JsonObjectStore`、KMS signing Terraform、S3 WORM Terraformは存在するが、production AWS accountでCloudTrail trail、log protection、S3 data events、alertingが構成済みであることは証明されていない。
- AWS reference architectureはCloudTrail、CloudWatch、AWS Config、Security Hub、GuardDuty、IAM Access Analyzerをtargetとして挙げるが、現行repoにproduction audit-control moduleはない。
- KMS `Sign`の暗号学的成功だけでは、正しいprincipalが正しいworkflowから署名した事実を証明しない。CloudTrail principal、time、request、physical key ARNとの相関が必要である。
- Evidence bucketのObject LockやVersioningが存在しても、object-level accessをCloudTrail data eventsで記録しなければ削除・上書き・読取の調査可能性が不足する。
- CloudTrail停止、trail変更、KMS lifecycle/policy変更、Evidence bucket policy/retention/public-access変更、IAM privilege変更を検知する実装がない。
- CloudTrail data events、log storage、notificationには従量課金があり、対象resourceを限定する必要がある。

## Candidate scope

- dedicated CloudTrail log bucket with public-access blocking, versioning, encryption, TLS-only access, CloudTrail-only delivery policy, and bounded lifecycle retention
- multi-Region CloudTrail with global service events, log file validation, all management events, and S3 object data events scoped to the configured Evidence bucket
- EventBridge detection rules for CloudTrail tampering, KMS administrative lifecycle/policy changes, Evidence S3 control changes, and IAM privilege-policy changes
- SNS topic as a notification boundary without subscriptions or human endpoints
- outputs and runbook that make deployment inputs, verification commands, expected alerts, cost, residual risk, and explicit Human Approval steps reviewable
- local static regression tests for critical Terraform control properties; `terraform fmt -check` / `terraform validate` only if tooling is locally available and without backend or AWS calls

## Explicit non-goals

- `terraform apply`, deploy, import, destroy, state mutation, or any live AWS API call
- modification of existing KMS keys, KMS key policies, Evidence bucket policies, Object Lock retention, IAM principals, or production roles
- AWS Config recorder/rules, Security Hub, GuardDuty, Organizations trails/SCPs, cross-account log archive, or SIEM integration
- CloudTrail Lake, application log ingestion, unusual signing-volume analytics, or formal compliance certification
- changes to Evidence processing, schemas, signing bytes, storage writes, PostgreSQL ledger, or external anchoring

## Security and governance boundary

- Security Reviewer is mandatory.
- Preserve `Evidence → Schema → Sign → Store → Ledger` unchanged; AWS audit controls observe the flow from a separate control plane.
- The audit trail must not be treated as proof that an upstream event was truthful or authorized.
- Do not place Evidence bodies, signatures, credentials, raw prompts, raw responses, secrets, or unnecessary PII in alert payloads or repository artifacts.
- Control-plane Terraform may describe future resources and least-privilege resource policies, but no live IAM/KMS/resource mutation is authorized.
- merge, deploy, AWS apply, IAM change, KMS change, retention change, and destructive operation remain explicit Human Approval boundaries.
- committed Agent Runtime remains dry-run by default.

## Expected validation

- CloudTrail configuration is multi-Region, includes global service events, enables log file validation, records all management events, and does not exclude KMS management events.
- S3 data events are limited to the configured Evidence bucket object ARN to contain cost and data exposure.
- CloudTrail log storage blocks public access, rejects non-TLS requests, uses versioning/encryption, and permits delivery only from the configured trail/account boundary.
- security-sensitive CloudTrail, KMS, S3, and IAM API changes route to a notification topic through explicit event patterns.
- no SNS subscription, email address, credential, account ID, bucket name, or live resource identifier is hard-coded.
- local tests verify the critical control contract without AWS credentials.
- `npm run check:structure`, implementation conformance, independent Reviewer, and independent Security Reviewer pass before Verification Evidence.

## Open questions

- Should the module use EventBridge direct detection or CloudWatch Logs metric filters for the first implementation?
- Should audit-log Object Lock be added now, or deferred until retention/legal requirements and recovery procedures are approved?
- Should IAM policy-change alerts cover the whole account or only future named production roles?
- Should SSE-KMS for CloudTrail logs be deferred to avoid coupling this Loop to a new encryption key policy?
