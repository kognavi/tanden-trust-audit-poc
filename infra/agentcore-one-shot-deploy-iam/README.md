# AgentCore one-shot deploy IAM design

This Terraform root **designs** a dedicated GitHub OIDC role for the one-shot AgentCore portfolio proof.

It deliberately does **not** add deploy privileges to the existing `gh-actions-tanden-audit-poc` role. That existing role currently trusts `repo:kognavi/tanden-trust-audit-poc:*`; adding deployment power there would let any trusted branch context inherit the same capability. The new role trusts only `refs/heads/main`.

## Caller-side permissions

The GitHub role itself has no direct CloudFormation create/update/delete, no IAM write, and no direct AgentCore create/update/delete actions.

It can only:

1. assume the dedicated `tandenpoc` CDK deploy and file-publishing roles for this account and region,
2. read the demo and `CDKToolkit` stack status,
3. read the dedicated CDK bootstrap version SSM parameter,
4. invoke / inspect / stop only AgentCore runtimes tagged `Project=tanden-trust-audit-poc`.

The GitHub role intentionally does **not** assume the image-publishing role. This Runtime uses AgentCore `CodeZip`, so the deployment path needs the CDK file asset path, not ECR image publishing. It also does not assume the lookup role because the current synthesized stack contains no context/VPC lookups.

## Critical delegated-privilege review

The target account/region is currently **not CDK-bootstrapped**. The Tanden PoC uses the dedicated qualifier `tandenpoc`; the corresponding `cdk-tandenpoc-*` roles and `CDKToolkit` stack are absent.

This changes the deployment sequence. The CDK deploy role ultimately delegates CloudFormation execution to the bootstrap execution role, so **do not apply this Terraform yet** and do not run a real AgentCore deploy until an explicit bootstrap design is reviewed.

From an administrator-authenticated local shell, inspect:

```bash
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGION="ap-northeast-1"
QUALIFIER="tandenpoc"

for ROLE in \
  "cdk-${QUALIFIER}-deploy-role-${ACCOUNT_ID}-${REGION}" \
  "cdk-${QUALIFIER}-file-publishing-role-${ACCOUNT_ID}-${REGION}" \
  "cdk-${QUALIFIER}-lookup-role-${ACCOUNT_ID}-${REGION}"
do
  echo "===== $ROLE ====="
  aws iam list-attached-role-policies --role-name "$ROLE"
  aws iam list-role-policies --role-name "$ROLE"
done
```

If the roles do not exist, that confirms the environment is unbootstrapped; do not treat that as a reason to auto-bootstrap.

The AgentCore CLI can auto-bootstrap when a real deploy runs with non-interactive confirmation. That path must not be used for this PoC until the bootstrap policy is explicitly constrained.

Before creating `CDKToolkit`, first inspect the local bootstrap template only:

```bash
cd agentcore/cdk
npm install --ignore-scripts --no-audit --fund=false
npx cdk bootstrap --show-template > ../../demo-output/cdk-bootstrap-template.yaml
```

The `--show-template` command is review-only; it does not deploy the bootstrap stack.

The CDK app is pinned to the same `tandenpoc` qualifier via `DefaultStackSynthesizer`. The Terraform root creates the dedicated managed policy `TandenAgentCoreCfnExecution`, scoped to the synthesized demo Runtime, its deterministic execution role, and the Runtime Identity service-linked role creation path.

After the Terraform plan is reviewed and the three IAM resources are explicitly approved, save the plan before applying it. Only after the managed policy exists may the bootstrap command be considered:

```bash
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGION="ap-northeast-1"

cd agentcore/cdk
npx cdk bootstrap "aws://${ACCOUNT_ID}/${REGION}" \
  --qualifier tandenpoc \
  --cloudformation-execution-policies \
  "arn:aws:iam::${ACCOUNT_ID}:policy/TandenAgentCoreCfnExecution"
```

Do not run that command yet. First review the post-PR Terraform plan and the synthesized CDK assembly to confirm the `tandenpoc` roles are referenced.

If the deploy path ultimately uses `AdministratorAccess` or another materially broad execution policy, stop. A caller policy that only grants `sts:AssumeRole` is not truly least-privilege if the assumed role can administer the account.

## Review-only plan

After merge, run:

```bash
cd infra/agentcore-one-shot-deploy-iam
terraform init
terraform validate
terraform plan
```

Expected result on first use is three creates:

- `aws_iam_policy.agentcore_cfn_execution`
- `aws_iam_role.agentcore_one_shot`
- `aws_iam_role_policy.agentcore_one_shot`

No existing IAM role, OIDC provider, S3 bucket, or AgentCore resource should be changed.

Do **not** run `terraform apply` until:

- this plan is reviewed,
- the `TandenAgentCoreCfnExecution` managed policy and its exact actions/resources are reviewed,
- the bootstrap template and role chain are reviewed,
- the one-shot workflow has an explicit human confirmation gate,
- teardown permissions and teardown verification are ready.

Do **not** run `agentcore deploy --yes` while `CDKToolkit` is absent, because that can cross the bootstrap boundary automatically.
