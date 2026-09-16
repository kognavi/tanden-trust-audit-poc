# Loop 017 One-shot Deployment Authorization

## Human decision

`HUMAN_ONE_SHOT_DEPLOY_ROLE_DECISION = GO`

This decision authorizes preservation of the reviewed least-privilege authorization set. It does not itself execute or authorize an AWS mutation from this repository operation. Any deployment must use the reviewed policies in this directory without broadening them and remains subject to the existing Loop 017 human gates.

## Frozen deployment provenance

- Account ID: `270887329967`
- Region: `ap-northeast-1`
- Confirmed human operator permission-set role: `AWSReservedSSO_AdministratorAccess_536f62a41cd35c92`
- One-shot deployment role: `TandenLoop017DirectCfnOneShotDeployRole`
- Runtime execution role: `TandenEvidenceDemoRuntimeExecutionRole`
- Runtime name: `TandenEvidenceDemo`
- Endpoint qualifier: `DEFAULT`
- CloudFormation stack: `tanden-loop017-agentcore-direct`
- Stack ARN scope: `arn:aws:cloudformation:ap-northeast-1:270887329967:stack/tanden-loop017-agentcore-direct/*`
- Artifact bucket: `tanden-trust-audit-poc-test-bucket`
- Frozen CodeZip SHA-256: `ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c`
- Frozen object ARN: `arn:aws:s3:::tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c/deployment_package.zip`
- `iam:PassRole` target: `arn:aws:iam::270887329967:role/TandenEvidenceDemoRuntimeExecutionRole`
- Nova 2 Lite JP inference profile: `arn:aws:bedrock:ap-northeast-1:270887329967:inference-profile/jp.amazon.nova-2-lite-v1:0`
- Tokyo foundation model: `arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-2-lite-v1:0`
- Osaka foundation model: `arn:aws:bedrock:ap-northeast-3::foundation-model/amazon.nova-2-lite-v1:0`
- Runtime Identity service-linked role status at review: absent; conditional creation only for `runtime-identity.bedrock-agentcore.amazonaws.com`.

## Authorization separation

### Bootstrap operator

The human operator may create, tag, configure, inspect, assume, and later remove only `TandenLoop017DirectCfnOneShotDeployRole`. The exact reviewed permissions are in `bootstrap-operator-policy.json`; its scope must not be expanded.

### One-shot deployment role

The role may manage only the named Loop 017 stack; upload/read/delete only the frozen CodeZip object; create and manage only the named runtime execution role; pass only that role to AgentCore; create, tag, inspect, and delete only the tagged Loop 017 Runtime and `DEFAULT` endpoint; remove the generated workload identity during rollback; and conditionally create only the required Runtime Identity service-linked role when absent.

`bedrock-agentcore:CreateAgentRuntime` retains its reviewed `Resource: "*"` because the runtime ARN does not exist before creation. It is constrained by mandatory Loop 017 request tags, the frozen artifact digest, and the absence of VPC subnet/security-group inputs. No other wildcard IAM action is approved.

The exact reviewed trust and permissions are in `one-shot-role-trust-policy.json` and `one-shot-role-permissions-policy.json`.

### Runtime execution role

AgentCore may assume only the named execution role from account `270887329967` for `TandenEvidenceDemo-*` runtimes in `ap-northeast-1`. Runtime permissions are limited to Nova 2 Lite JP invocation and the reviewed CloudWatch Logs/X-Ray telemetry operations. The `Resource: "*"` uses for `logs:DescribeLogGroups` and X-Ray write APIs are retained only where those APIs do not support narrower resource authorization.

The exact reviewed trust and permissions are in `runtime-execution-role-trust-policy.json` and `runtime-execution-role-permissions-policy.json`.

## Explicit exclusions

- No `AdministratorAccess` is attached to the one-shot role.
- No `iam:*`, `bedrock:*`, or `cloudformation:*` action wildcard is granted.
- No CDK bootstrap, ECR, image publishing role, deployment role family, or automatic IAM expansion is authorized.
- No production RPC, blockchain transaction, external anchor, deploy outside the reviewed direct-CloudFormation path, or persistent demo resource is authorized.
- No account credential, access key, secret key, session token, model input, customer data, PII, or other secret is stored in these artifacts.

## Integrity and governance

`authorization-provenance.json` records the SHA-256 digest of each reviewed artifact. Existing Loop 017 Task Graph and Verification Evidence remain immutable because this post-completion human authorization preservation does not alter the verified implementation or its prior review results.

AWS mutation count for this preservation step: `0`.
