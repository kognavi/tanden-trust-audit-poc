# Loop 017B — Lambda + Nova 2 Lite fallback design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- Context ID: `context-pack-loop-017-live-ai-agent-collector-completion`

## Current State

The starting source is local commit `9148c8451d7b092397ecdf5b3fb1d37c64233546`. The current Loop 017 AgentCore implementation and its evidence remain intact and **BLOCKED** for live Runtime creation. Loop 017B is an additive, separately named path. It does not change or reinterpret the AgentCore result.

AWS documentation checked during design: [Nova 2 Lite model/Region support](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html), [Nova tool choice](https://docs.aws.amazon.com/nova/latest/nova2-userguide/request-response-schema.html), [geographic inference IAM](https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html), [Lambda synchronous retry behavior](https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html), and [Bedrock CloudTrail events](https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html). Recheck service availability and profile destinations before a deployment GO; no AWS call is part of this specification step.

## Proposed Design

### Architecture and trust boundaries

```text
manual synchronous Lambda Invoke (fixed synthetic run ID only)
  → Lambda wrapper: fixed prompt/tool schema/target
  → one Bedrock Runtime Converse to jp.amazon.nova-2-lite-v1:0
  → validate one expected toolUse; execute local no-op
  → wrapper-generated sanitized auditEvent + AWS request metadata
  → Lambda Nova collector → Normalized Agent Event schema
  → existing AI Agent Evidence mapper → EvidenceProcessingService
  → AI Agent Evidence schema → local ECDSA Sign → local demo Store → local demo Ledger
  → Store reload → digest/signature PASS → tampered clone FAIL
```

The Lambda response is an observation from a limited producer, not an authority for signing or policy decisions. The collector rejects malformed envelopes, mismatched run/session/trace IDs, unapproved model/profile IDs, unexpected fields, and PII/secrets flags. The wrapper sets `sourceSystem` to a distinct Lambda/Bedrock value. `AGENT_TOOL_CALL` records the model-requested, wrapper-validated synthetic no-op. `action.operation` must reflect execution of that no-op; `sideEffect.category` is `NONE`, with a synthetic resource URI. `policy.decision` and `approval.status` reflect the fixed allowlist and approved manual run, not prose from Nova. Tests assert every required actor/agent/model/execution/policy/action/approval/side-effect/reference field retains its meaning.

The existing `EvidenceProcessingService` continues to enforce Schema → Sign → Store → Ledger. A new Loop 017B runner may use an append-only, clone-on-read local demo Store and deterministic Ledger double, matching the established demo contract. It cannot claim a durable database or immutable AWS storage. The runner reloads the stored record after Ledger success and validates identity, version, digest, and signature before creating an allowlisted summary. Existing AgentCore modules and fixtures are not edited or imported as a misleading source identity.

### Invocation contract

- The operator supplies a UUID-like `runId` only. The Lambda handler owns the synthetic prompt, one tool specification, fixed `synthetic://` target, model profile ID, and inference settings. A fixed input SHA-256 is recorded in the sanitized result.
- Use the `bedrock-runtime` `Converse` API, non-streaming, with one tool and forced tool choice. Set a small `maxTokens` cap and bounded timeout. No follow-up `Converse`, model-driven loop, or fallback model is allowed.
- Configure the Bedrock SDK with `maxAttempts: 1`; configure the invoking AWS client/CLI for one attempt. Invoke Lambda synchronously with `RequestResponse`. Do not configure an event source, asynchronous invocation, or retry destination. One operator-approved run ID is used once.
- Validate `stopReason` and exactly one content block containing the expected `toolUse`. Reject text-only, zero/multiple tool calls, invalid JSON/arguments, a different tool, or target drift. The no-op tool has no network or persistent write operation. Do not fabricate `EXTERNAL_WRITE: SUCCESS`.
- If Bedrock times out or the Lambda response is lost after a request may have been sent, record `INDETERMINATE` and stop. Do not retry automatically or manually under the same GO. A true once-only guarantee across such failures is outside the design with 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda.

### Evidence and independent live observations

The Lambda returns only the validated `auditEvent` and an allowlisted receipt: Lambda `awsRequestId`, Bedrock response request ID, source Region, profile ID, UTC time, token usage, run ID, and fixed-input/code digests. The local collector verifies correlation and strips transport metadata before canonical Evidence mapping. The local processor does not receive raw prompt/model output. Application logs contain the run/request IDs and status codes, not request/response bodies, tool arguments, credentials, signatures, or private keys. Bedrock model invocation logging remains disabled for this demo because it can retain input/output bodies.

After separately approved live execution, read-only CloudTrail lookup for `Converse` and Lambda logs must correlate with the receipt and show one matching model call and one function run. Bedrock `Converse` is a CloudTrail management event; CloudTrail and logs are independent execution evidence, while the signed Evidence establishes integrity of the wrapper's structured observation. Neither alone proves the model's proposed tool content was truthful. Preserve only sanitized exports and digests in new Loop 017B evidence locations; never append to or rewrite Loop 017 AgentCore history.

### AWS resources and IAM design for future review

An isolated Terraform root will describe 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda: one Lambda function, one dedicated Lambda execution role, its inline policy, and one CloudWatch log group with short retention. Deploy a reviewed local ZIP; no S3 staging bucket is required by this design. The function has no VPC, automatic event source, Function URL, API Gateway, EventBridge, queue, schedule, or other invocation trigger; no database, new KMS key, or provisioned model throughput is added. Tag the resources as Loop 017B and set a short timeout and small memory size. Reserved concurrency is not used for this one-off PoC because the reported account concurrency quota is 10 and AWS requires at least 10 unreserved slots. G4 allows exactly one intended human-approved synchronous `RequestResponse` invocation with caller and SDK retries disabled. An ambiguous result is `INDETERMINATE`; stop without retrying. There is no durable duplicate-run lock: another authorized manual request could invoke the model again. Production deployment must restore a technical concurrency/idempotency control that rejects duplicate or concurrent requests; reserved concurrency alone would not guarantee exactly-once execution. Execution-role IAM remains unchanged.

Execution-role trust is limited to `lambda.amazonaws.com`. Its permission policy allows:

1. `bedrock:InvokeModel` on the Tokyo `jp.amazon.nova-2-lite-v1:0` inference-profile ARN for account `270887329967`;
2. `bedrock:InvokeModel` on the Nova 2 Lite foundation-model ARNs in the profile's source and candidate destination Regions, with `bedrock:InferenceProfileArn` restricted to that profile; the currently documented Japan set is Tokyo and Osaka, to be verified read-only before deployment;
3. `logs:CreateLogStream` and `logs:PutLogEvents` only for the dedicated Lambda log group/streams.

No `bedrock:InvokeModelWithResponseStream`, wildcard model grant, AgentCore action, `iam:PassRole` in the execution role, S3, KMS, database, or Secrets Manager permission is planned. The human/operator identity needs only a separately reviewed `lambda:InvokeFunction` grant on the exact function ARN for the one-shot run; any deployment principal permissions are reviewed separately and are not added to AgentCore identities. A Terraform plan is a review artifact, never implicit apply approval.

## Affected Components

Planned implementation files (future work, not created by this spec):

- `lambda/loop017b/handler.js`: fixed-input wrapper, single Bedrock request, no-op tool, sanitized envelope.
- `lib/collectors/lambda-nova-collector.js`: correlation and normalized-event validation.
- `lib/lambda-nova-live-demo.js`: existing mapper/processor composition and post-Ledger reload verification.
- `scripts/process-lambda-nova-response.js`: local processing of an already captured Lambda response; no AWS API.
- `tests/lambda-nova-handler.test.js`, `tests/lambda-nova-collector.test.js`, `tests/lambda-nova-live-demo.test.js`: AWS-free unit, negative, and end-to-end tests.
- `infra/loop017b-lambda/main.tf` and `infra/loop017b-lambda/README.md`: isolated resource plan and manual lifecycle.
- `docs/loop-017b-lambda-nova-live-demo.md` and a new Loop 017B knowledge note: operational contract and AgentCore `BLOCKED` provenance.
- `docs/module-registry.md`, `docs/README.md`, `package.json`, and `package-lock.json`: only the needed registry/index and pinned SDK/script additions.

Before implementation, check this list against the approved checkout, module registry, and architecture dependency rules. Do not modify existing AgentCore Loop 017 evidence/history to make the fallback pass.

## Trust Boundary Impact

The Lambda wrapper and collector are ingress only. The normalized schema and existing mapper precede the existing `EvidenceProcessingService`, which retains Schema → Sign → Store → Ledger ordering. Post-Ledger Store reload and signature/tamper checks are read-only verification. No new AWS signing, Store, or Ledger path is introduced.

## Security

The model can propose only a tool use; the wrapper validates it and records only observed no-op execution facts. Fixed synthetic inputs, reject-by-default parsing, a dedicated least-privilege Lambda role, no real PII/secrets, no raw-content logging, and independent CloudTrail correlation define the security boundary. AgentCore IAM and historical evidence remain untouched.

## Cost and Operations

Normal development is AWS-free. A later approved run creates only the 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda and incurs one bounded Lambda/Bedrock use. No idle compute, database, NAT, provisioned throughput, or model invocation body logging is planned. Logs have short retention; sanitized exports are retained locally for review.

## Alternatives Considered

- Calling Nova from the developer machine would reduce AWS resources but would not prove a live Lambda collector boundary.
- Adding DynamoDB would support a durable once-only latch but increases resources, IAM, and cost; this demonstration instead stops on ambiguous outcomes.
- Putting signing/storage inside Lambda would create extra IAM and trust boundaries; local processing reuses the repository's existing canonical service.
- Existing local Store/Ledger doubles prove pipeline behavior, not PostgreSQL durability or production audit completeness.

## Validation Plan

Local first: mocked SDK tests enforce call count and data minimization; contract tests cover all rejection paths; end-to-end tests prove schema/sign/store/ledger/reload order and tamper detection. Run focused tests, `npm run check:structure`, Terraform formatting/validation and plan review, spec/conformance/verification gates as applicable, and independent security review. None of those tests may require AWS credentials or invoke Nova.

Deployment and inference require separate human GO decisions. The deployment GO reviews exact ZIP SHA-256, Terraform diff, role policy, log retention, cost ceiling, and cleanup. After deployment, read-only preflight checks the function/configuration, profile destinations, IAM authorization, and CloudTrail availability. The inference GO reviews the fixed input digest, `runId`, one-attempt command, and no-retry stop rule. After evidence capture, remove only the Loop 017B resources under a separately reviewed cleanup action. Preserve sanitized evidence; never delete or reinterpret the AgentCore rollback/Support evidence.

## Review Checklist

- [x] Current-state claims checked against the existing schema, mapper, service, and Loop 017 demo contract.
- [x] Trust boundary, `BLOCKED` status, data minimization, IAM, cost, and human GO boundaries are explicit.
- [x] Future implementation and independent security review remain separate tasks.
