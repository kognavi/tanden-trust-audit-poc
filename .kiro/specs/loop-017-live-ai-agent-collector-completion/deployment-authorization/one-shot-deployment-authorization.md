# Loop 017 One-shot Deployment Authorization

## Human decision

`HUMAN_ONE_SHOT_DEPLOY_ROLE_DECISION = GO`

This is the historical authorization decision. The later dependent-endpoint authorization candidate failed Security Review and was never approved for application. The revised initial-create design below is a new review candidate, not authorization to deploy. The CodeZip and template version IDs remain unknown; placeholders intentionally deny creation until an independently reviewed freeze and human decision.

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
- Frozen CodeZip S3 VersionId: **not provided**; `__FROZEN_CODEZIP_VERSION_ID_REQUIRED__` is a fail-closed placeholder.
- Initial-create template S3 VersionId: **not provided**; `__FROZEN_TEMPLATE_VERSION_ID_REQUIRED__` is a fail-closed placeholder.
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

The revised one-shot role can create the named stack only with the exact S3 template URL and the declared `AWS::BedrockAgentCore::Runtime` resource type. It can read only the frozen CodeZip and template objects; it cannot upload/delete them or create/edit the execution role. A human must separately provision the already reviewed execution role under a distinct approval and upload a versioned, read-only-to-the-deploy-role template. The role can pass only the named execution role to AgentCore. Existing tagged Runtime, default endpoint, rollback workload identity, and conditional service-linked-role operations retain their narrower scopes. Any human provisioning or AWS retry needs a separate decision.

CloudFormation's `CreateStack` API prohibits specifying both `Capabilities` and `ResourceTypes`. A template with `AWS::IAM::Role` would require `CAPABILITY_NAMED_IAM`, so the proposed initial-create stack contains **one** resource, `AWS::BedrockAgentCore::Runtime`; the execution role is provisioned separately. The explicit `AWS::BedrockAgentCore::RuntimeEndpoint` resource is removed: `CreateAgentRuntime` already creates `DEFAULT` and separate CloudFormation ownership of the same qualifier can collide. The exact endpoint conflict response is not established without an AWS call.

`bedrock-agentcore:CreateAgentRuntime` retains its reviewed `Resource: "*"` because the runtime ARN does not exist before creation. It is constrained by mandatory Loop 017 request tags, the frozen artifact digest, and the absence of VPC subnet/security-group inputs. No other wildcard IAM action is approved.

The exact reviewed trust and permissions are in `one-shot-role-trust-policy.json` and `one-shot-role-permissions-policy.json`.

### CloudFormation tag authorization remediation

A direct CloudFormation deployment attempt was denied at `AWS::BedrockAgentCore::Runtime` creation. CloudTrail showed that `CreateAgentRuntime` carried the four required Tanden tags and CloudFormation's `aws:cloudformation:stack-name`, `aws:cloudformation:stack-id`, and `aws:cloudformation:logical-id` keys. The `ForAllValues:StringEquals` allowlist in `aws:TagKeys` excluded those three system keys.

The allowlists for `CreateAgentRuntime`, `CreateAgentRuntimeEndpoint`, and `TagResource` now admit exactly those three additional CloudFormation keys, accounting for tag propagation at Runtime creation and the subsequent Endpoint/tagging paths. Existing required `aws:RequestTag` conditions, resource and role scopes, and PUBLIC/no-VPC conditions are unchanged. This is a policy preparation; no retry or additional AWS call was made during remediation. Whether a later `TagResource` call includes the required Tanden request tags must be checked from CloudTrail if that call is denied; the required conditions are not relaxed here.

### Initial DEFAULT endpoint dependent authorization

On the second, human-run CloudFormation attempt, the tag-key check passed and `CreateAgentRuntime` then failed its dependent `bedrock-agentcore:CreateAgentRuntimeEndpoint` authorization on `arn:aws:bedrock-agentcore:ap-northeast-1:270887329967:runtime/*`. AgentCore creates the initial `DEFAULT` endpoint as part of runtime creation, before the new runtime's resource tags can be relied on for the dependent permission check.

The historical candidate added `CreateInitialDefaultEndpointDuringRuntimeBootstrap` for only `bedrock-agentcore:CreateAgentRuntimeEndpoint` on the account- and region-scoped `runtime/*` ARN. Required Tanden and CloudFormation request-tag values and exact tag keys remain. The redesign additionally requires `aws:ViaAWSService = true` and `aws:CalledVia = cloudformation.amazonaws.com`; direct calls cannot use this bootstrap Allow. CloudFormation must use a forward access session for these keys to exist. Whether the AgentCore dependent authorization receives that context and all required request tags is **unverified**; missing context denies by default, and must never be addressed by silently relaxing the condition. The `CreateOnlyTaggedDefaultEndpoint` statement remains byte-for-byte unchanged. Runtime digest, PUBLIC/no-VPC and exact PassRole remain unchanged.

Historical Security re-review **FAIL** is preserved in `authorization-provenance.json`: the former policy could submit another template with the approved stack name/logical ID to operate on an unrelated runtime. The new `CreateStack` statement binds the exact versioned `TemplateUrl` and requires the declared single resource type; the one-shot role has no object-write permission, and the only pinned template resource is `Runtime`. A versioned bucket is not intrinsically immutable: a privileged operator can still change/upload objects or edit IAM; control of the template and role bootstrap must remain outside this deployment role. The restrictive `CreateStack` policy does not grant `UpdateStack` or `CreateChangeSet`.

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

`authorization-provenance.json` records the SHA-256 digest of each reviewed artifact. Existing Loop 017 Task Graph and Verification Evidence remain immutable because this post-completion human authorization preservation does not alter the verified implementation or its prior review results.

AWS mutation count for this preservation step: `0`.
