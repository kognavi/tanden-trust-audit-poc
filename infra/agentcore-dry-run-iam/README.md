# AgentCore dry-run IAM patch

This directory is an intentionally isolated Terraform root used only to add the read-only CloudFormation permission required by the manual AgentCore Runtime dry-run.

It does **not** manage the repository's existing OIDC provider, GitHub Actions role, or S3 integration-test bucket. The existing IAM role is resolved with a data source and only one inline policy is managed here.

Expected first plan:

```text
Plan: 1 to add, 0 to change, 0 to destroy.
```

The managed permission is only:

```text
cloudformation:DescribeStacks
```

scoped to the `AgentCore-TandenEvidenceDemo-default` stack.

Run:

```bash
cd infra/agentcore-dry-run-iam
terraform init
terraform validate
terraform plan
```

Do not apply unless the plan contains only `aws_iam_role_policy.agentcore_dry_run_read` as a created resource. IAM privilege expansion requires explicit human approval.
