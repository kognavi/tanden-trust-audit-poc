# Production AWS Audit Controls Terraform Module

This standalone module defines a production-oriented AWS audit control plane. It is intentionally not instantiated by `infra/environments/poc` or any automated workflow.

## What it defines

- a dedicated, versioned, encrypted, non-public Amazon S3 bucket for AWS CloudTrail logs
- a multi-Region trail with global service events and log file validation
- all management events, without excluding AWS KMS
- Amazon S3 object data events scoped to one existing Evidence bucket
- Amazon EventBridge rules for security-sensitive CloudTrail, KMS, Evidence S3, and IAM changes
- an Amazon SNS notification topic and a source-constrained EventBridge publish policy

It does not define subscriptions, IAM roles or policies, KMS keys or policies, AWS Config, Security Hub, GuardDuty, Organizations controls, CloudTrail Lake, or application resources.

## Trust-boundary position

This module observes AWS control-plane and selected S3 data-plane activity. It does not process business Evidence and does not participate in:

```text
Evidence → Schema → Sign → Store → Ledger
```

CloudTrail records API activity. It does not prove that an upstream business event was truthful, authorized, or complete.

## Example configuration

The following is illustrative configuration for a separately reviewed root module. Do not copy account identifiers or names from documentation into production.

```hcl
module "production_aws_audit_controls" {
  source = "../../modules/production-aws-audit-controls"

  project_name       = "tanden-trust-audit"
  source_account_id  = var.aws_account_id
  home_region        = var.aws_region
  aws_partition      = "aws"
  evidence_bucket_arn = var.evidence_bucket_arn
  log_bucket_name    = var.cloudtrail_log_bucket_name
  log_retention_days = 365
}
```

No example root configuration is committed because connecting the module to an environment is a deployment decision.

`home_region` must exactly match the inherited AWS provider Region. The module uses it to construct the CloudTrail ARN allowed by the log-bucket policy; a mismatch can prevent CloudTrail delivery. Confirm the provider configuration and this input together during environment binding and saved-plan review.

## Required human decisions before use

1. Inventory existing account and organization trails to avoid duplicate management-event copies and unexpected cost.
2. Select a globally unique log bucket name and an approved retention period.
3. Confirm that `home_region` exactly matches the inherited AWS provider Region.
4. Decide whether same-account storage is sufficient or a security log archive account is required.
5. Decide whether Object Lock or SSE-KMS is required after legal, retention, recovery, and key-policy review.
6. Select and approve SNS subscribers and incident ownership.
7. Review a saved Terraform plan for replacement, deletion, public exposure, IAM/KMS change, and recurring cost.
8. Obtain explicit Human Approval before apply.

## Validation without AWS mutation

Repository tests inspect the security contract without AWS credentials:

```bash
node --test tests/production-aws-audit-controls.test.js
npm run check:structure
```

When Terraform CLI is available, formatting and offline configuration validation may also be run. Do not run `terraform plan` or `terraform apply` as part of default CI.

## Residual risks

- A sufficiently privileged administrator in the same account can alter the trail, bucket policy, EventBridge rules, or topic. Cross-account organization trails and SCPs are not implemented.
- The log bucket is versioned but does not use Object Lock. CloudTrail log file validation detects changed, deleted, or missing log files; it does not prevent deletion.
- S3 data events incur additional CloudTrail charges. This module limits them to the configured Evidence bucket but records both reads and writes.
- EventBridge detects discrete administrative calls; unusual KMS signing volume requires a separate metrics/analytics control.
- An SNS topic without a subscription has no human recipient. Subscription creation remains an explicit deployment approval step.
