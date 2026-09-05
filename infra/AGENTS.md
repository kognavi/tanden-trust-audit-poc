# infra/ Terraform and AWS Rules

root `AGENTS.md`を補足し、`infra/`配下へ適用します。

## Source of truth
このRepositoryのInfrastructure as CodeはTerraformです。AI Development OSを理由にCDKへ置換したり並行IaCを追加しません。

## Review points
- IAM least privilege
- AWS KMS key policy / separation of duties
- GitHub Actions OIDC trust conditions
- S3 encryption/versioning/Object Lock
- CloudTrail/auditability
- public exposure
- destructive lifecycle changes
- fixed/idle cost

## Validation
Terraform変更では可能な範囲で `terraform fmt -check`、`terraform validate`、plan/diff reviewを行う。

## Human approval required
production apply、destroy、state manipulation、IAM/KMS privilege expansion、retention/security control removal、public exposure expansion、material cost increase。
