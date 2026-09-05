---
name: aws-security-review
description: Review AWS, Terraform and integration changes for IAM, KMS, OIDC, storage, secrets, logging, retention and public-exposure risks.
---

# AWS Security Review

Check IAM least privilege, GitHub Actions OIDC trust, AWS KMS separation of duties, S3 encryption/versioning/Object Lock, secrets handling, auditability, public exposure, Terraform lifecycle risk and cost.

Preserve the repository trust boundary. Do not perform production apply/destroy or privilege expansion as part of review.

Report severity, evidence, impact, recommendation and residual risk.
