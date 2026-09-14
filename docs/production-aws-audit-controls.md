# Production AWS Audit Controls

## Status

Repository implementation: **Terraform module and local regression tests only**.

Deployment status: **not deployed or verified in a live AWS account**.

Loop 015 does not authorize AWS apply, deploy, IAM or KMS changes, retention changes, notification subscriptions, or destructive operations.

## Objective

The audit control plane supplies three capabilities that are separate from business Evidence processing:

1. Record AWS management activity and Evidence S3 object access.
2. Protect and validate delivered CloudTrail logs.
3. Notify a separately approved operations channel about security-sensitive administrative changes.

It does not change or bypass the repository invariant:

```text
Evidence → Schema → Sign → Store → Ledger
```

## Control map

| Risk | Preventive / protective baseline | Detective baseline | Residual risk |
|---|---|---|---|
| CloudTrail disabled or altered | source-constrained log bucket policy; no `force_destroy` | multi-Region trail, log validation, EventBridge rule | same-account admin can modify multiple controls |
| Evidence object access hidden | data selector scoped to the Evidence bucket | S3 object data events | data-event cost; CloudTrail records activity, not business truth |
| KMS governance changed | existing KMS separation-of-duties design remains external | KMS lifecycle/policy/grant/alias events | unusual `Sign` volume is not yet analyzed |
| Evidence bucket controls weakened | existing bucket controls remain external | bucket policy/public access/Versioning/Object Lock/lifecycle events | EventBridge notification requires an approved subscriber |
| IAM privilege expanded | existing IAM design remains external | account-wide policy/role change events | no SCP or automated remediation |
| CloudTrail logs modified or deleted | Versioning, SSE-S3, public block, TLS-only policy | CloudTrail log file integrity validation | no Object Lock or cross-account archive |
| Notification path disabled | source-constrained SNS publish policy | EventBridge/SNS administrative change events | deleting the target can prevent immediate delivery; CloudTrail remains the record plane |

## Event correlation

The intended audit investigation path is:

```text
Evidence ID
  → signed metadata and physical KMS key ARN
  → PostgreSQL Ledger event
  → CloudTrail KMS principal / eventTime / request ID
  → Evidence bucket object data events
```

Correlation improves traceability but does not prove that a source event was complete, truthful, or properly approved.

## Deployment separation

The module under `infra/modules/production-aws-audit-controls/` is not referenced by an environment root. This prevents a normal repository test or an unrelated PoC apply from creating audit resources.

The following are separate human-controlled phases:

1. **Design/code review** — repository-only; performed in Loop 015.
2. **Environment binding** — choose account, Region, Evidence bucket, log bucket, retention, and subscribers.
3. **Plan review** — save and inspect the exact Terraform plan; compare with existing account/organization trails.
4. **Apply approval** — explicit Human Approval immediately before mutation.
5. **Operational verification** — verify trail status, selectors, delivery, digest files, alerts, access, and cost telemetry.

## Pre-deployment review checklist

- Confirm whether an AWS Organizations trail already captures required management events.
- Confirm that additional trail copies and S3 data events are economically justified.
- Confirm the Evidence bucket ARN and that data events are not configured for all S3 buckets.
- Confirm the log bucket name is globally unique and dedicated to CloudTrail.
- Confirm retention with security, audit, legal, and operations stakeholders.
- Decide whether same-account storage is acceptable; prefer a log archive account for stronger administrative separation.
- Decide whether Object Lock or SSE-KMS is required and review recovery/key-policy implications separately.
- Identify SNS subscribers, escalation ownership, and a periodic alert-path test.
- Confirm the plan contains no unexpected IAM/KMS changes, replacement, public exposure, or destroy action.

## Post-deployment verification checklist

After a separately approved apply, an operator should verify without committing sensitive output:

- trail logging status is active and multi-Region
- global service events and log file validation are enabled
- management events are recorded and KMS is not excluded
- S3 data events reference only the approved Evidence bucket object ARN
- CloudTrail log and digest files arrive under the expected account prefix
- bucket Versioning, ownership enforcement, SSE-S3, public block, TLS deny, and lifecycle are effective
- each EventBridge rule is enabled and targets the expected SNS topic
- a controlled test event reaches an approved subscriber
- CloudTrail log integrity validation succeeds for a bounded test period
- cost telemetry is reviewed after representative Evidence volume

Do not use destructive tests against production resources. Test alert paths with reversible, approved actions in a non-production account first.

## Rollback and incident boundary

Disabling or deleting audit controls reduces forensic visibility and is not a routine rollback. If a plan proposes trail deletion, logging disablement, log-bucket replacement, retention shortening, or notification removal, stop and require explicit security and Human Approval.

Application rollback and audit-control rollback are separate. The Evidence application can be rolled back without deleting historical CloudTrail logs.

## Cost profile

- Management event cost depends on existing trail copies; inventory account and organization trails first.
- S3 data events are charged and usually dominate the incremental audit cost. Scope is deliberately limited to one Evidence bucket.
- S3 storage and request costs grow with activity and retention.
- EventBridge and SNS are request-based; actual cost depends on administrative-event volume and delivery method.
- Object Lock, CloudTrail Lake, CloudWatch Logs ingestion, AWS Config, Security Hub, and GuardDuty are not included in this baseline.

## Official references

- [Security best practices in AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [Validating CloudTrail log file integrity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [Logging data events with CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)
- [Logging AWS KMS API calls with AWS CloudTrail](https://docs.aws.amazon.com/kms/latest/developerguide/logging-using-cloudtrail.html)
- [Amazon S3 CloudTrail events](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cloudtrail-logging-s3-info.html)
