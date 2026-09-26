# Loop 017 One-shot Deployment Authorization

## Human decision

`HUMAN_ONE_SHOT_DEPLOY_ROLE_DECISION = GO`

This is the historical authorization decision. The dependent-endpoint authorization candidate failed Security Review, and the first S3 template freeze failed because its digest belonged to a placeholder template. The corrected version-specific authorization is now historical. The current SHA-256-first design and mandatory pre-deploy gate are in `sha256-first-deployment.md`. This repository change authorizes no AWS operation or policy application.

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
- Reported CodeZip S3 VersionId: `JIomLDig_.IZDKIHa3WFja.qJHIELImp` (reported SHA-256 matches the frozen CodeZip digest; AWS object bytes were not read during this operation).
- Reported final initial-create template S3 VersionId: `NCd4Nwob4IzIBElxVNiSFu8g_o2l5Xlr`; operator-reported S3 SHA-256 `39afd82b613d4e6146a15a9c8e48d01733597e45e26e594fdf3c57cc46c8ccd2` matches the local finalized template. The S3 object bytes were not read by this repository operation.
- Historical version-specific policy URL: `https://s3.ap-northeast-1.amazonaws.com/tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml?versionId=NCd4Nwob4IzIBElxVNiSFu8g_o2l5Xlr`. Current IAM uses this exact bucket/key without a VersionId and requires the pre-deploy SHA-256 gate.
- Previous version-freeze FAIL for template VersionId `PR7supqi6_lC.IdM_0ErW82M.RhKDwRA` and SHA-256 `4d0513235f3b71f073b886afacb27ebe8f7ad70e072ca1052fa1127ffe8093a8` remains recorded separately. Do not use that earlier S3 version for deployment.
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

The one-shot role can create the named stack only with the exact unversioned S3 template URL and the declared `AWS::BedrockAgentCore::Runtime` resource type. It can read only the frozen CodeZip and template keys; it cannot upload/delete them or create/edit the execution role. A human must separately provision the reviewed execution role under another approval. Before any deployment, the operator must compare downloaded S3 bytes against the Git-committed SHA-256 values and record the observed VersionIds using `sha256-first-deployment.md`. The role passes only the named execution role to AgentCore; all other action and resource scopes remain. Any AWS action needs a separate human decision.

CloudFormation's `CreateStack` API prohibits specifying both `Capabilities` and `ResourceTypes`. A template with `AWS::IAM::Role` would require `CAPABILITY_NAMED_IAM`, so the proposed initial-create stack contains **one** resource, `AWS::BedrockAgentCore::Runtime`; the execution role is provisioned separately. The explicit `AWS::BedrockAgentCore::RuntimeEndpoint` resource is removed: `CreateAgentRuntime` already creates `DEFAULT` and separate CloudFormation ownership of the same qualifier can collide. The exact endpoint conflict response is not established without an AWS call.

`bedrock-agentcore:CreateAgentRuntime` retains its reviewed `Resource: "*"` because the runtime ARN does not exist before creation. It is constrained by mandatory Loop 017 request tags, the frozen artifact digest, and the absence of VPC subnet/security-group inputs. No other wildcard IAM action is approved.

The reviewed trust policy and current version-specific permissions candidate are in `one-shot-role-trust-policy.json` and `one-shot-role-permissions-policy.json`, respectively. Approval to apply this policy or deploy remains a separate human decision.

### CloudFormation tag authorization remediation

A direct CloudFormation deployment attempt was denied at `AWS::BedrockAgentCore::Runtime` creation. CloudTrail showed that `CreateAgentRuntime` carried the four required Tanden tags and CloudFormation's `aws:cloudformation:stack-name`, `aws:cloudformation:stack-id`, and `aws:cloudformation:logical-id` keys. The `ForAllValues:StringEquals` allowlist in `aws:TagKeys` excluded those three system keys.

The allowlists for `CreateAgentRuntime`, `CreateAgentRuntimeEndpoint`, and `TagResource` now admit exactly those three additional CloudFormation keys, accounting for tag propagation at Runtime creation and the subsequent Endpoint/tagging paths. Existing required `aws:RequestTag` conditions, resource and role scopes, and PUBLIC/no-VPC conditions are unchanged. This is a policy preparation; no retry or additional AWS call was made during remediation. Whether a later `TagResource` call includes the required Tanden request tags must be checked from CloudTrail if that call is denied; the required conditions are not relaxed here.

### Initial DEFAULT endpoint dependent authorization

On the second, human-run CloudFormation attempt, the tag-key check passed and `CreateAgentRuntime` then failed its dependent `bedrock-agentcore:CreateAgentRuntimeEndpoint` authorization on `arn:aws:bedrock-agentcore:ap-northeast-1:270887329967:runtime/*`. AgentCore creates the initial `DEFAULT` endpoint as part of runtime creation, before the new runtime's resource tags can be relied on for the dependent permission check.

The historical candidate added `CreateInitialDefaultEndpointDuringRuntimeBootstrap` for only `bedrock-agentcore:CreateAgentRuntimeEndpoint` on the account- and region-scoped `runtime/*` ARN. The earlier redesign required `aws:ViaAWSService = true` and `aws:CalledVia = cloudformation.amazonaws.com`. Operator-reported CloudTrail evidence shows dependent authorization denied this action without a separate endpoint event; IAM simulation allows the bootstrap context with those FAS keys and implicitly denies it without them. A subsequent operator-reported `simulate-custom-policy` evaluates the dependent action on the literal `runtime/*` ARN and returns `implicitDeny` with every request-tag/CloudFormation context supplied and no missing context values. The current candidate retains the removed FAS conditions and changes only the bootstrap Resource back to `runtime/*`. Required Tanden and CloudFormation request-tag values, exact tag keys, account and Region remain. A matching request context could now authorize an endpoint on any runtime in that account and Region, so this one-shot role must remain tightly controlled. The reported simulation does not prove that the live dependent authorization carries every required tag or that a direct API caller can supply the reserved CloudFormation tags. A separately authorized retry must stop on a denial without relaxing the remaining conditions. The `CreateOnlyTaggedDefaultEndpoint` statement remains unchanged. Runtime digest, PUBLIC/no-VPC and exact PassRole remain unchanged.

Historical Security re-review **FAIL** is preserved in `authorization-provenance.json`: the former policy could submit another template under the allowed stack name/logical ID to operate on an unrelated runtime. The current `CreateStack` statement binds the exact template bucket/key URL and the single Runtime type; the one-shot role has no object-write, `UpdateStack`, or `CreateChangeSet` grant. The bootstrap `runtime/*` resource now also covers unrelated runtimes if a request can satisfy its tag conditions; absent FAS conditions, IAM alone does not bind this statement to CloudFormation. An independent writer to the exact S3 key could still replace bytes between verification and CloudFormation's read. This residual race and its NO-GO condition are documented in `sha256-first-deployment.md`.

This remediation is based on the reported CloudTrail denial; the dependent authorization context has not been retested. If the service does not supply the required Tanden and reserved CloudFormation request tags to that check, it will remain denied and must be diagnosed from a separately authorized retry. No AWS call or deploy was performed during preparation.

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

`authorization-provenance.json` records current SHA-256 values and preserves all prior failed and completed version-specific reviews. The Git commit and SHA-256-first gate replace VersionIds as executable inputs; VersionIds remain observational provenance. Neither reviewer PASS nor an artifact hash authorizes deployment. Existing Loop 017 Task Graph and Verification Evidence remain immutable because this change does not alter the verified collector implementation.

AWS mutation count for this preservation step: `0`.
