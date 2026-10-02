# Loop 017B — Lambda + Nova 2 Lite fallback requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- Context ID: `context-pack-loop-017-live-ai-agent-collector-completion`
- Loop 017B extends this prior collector context; its changed AWS runtime choice and approval boundary are specified here.

## Current Implementation Truth

- Approved starting HEAD: `9148c8451d7b092397ecdf5b3fb1d37c64233546` on `feature/loop-017-live-ai-agent-collector-completion`.
- Prior context: `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`, the completed Loop 017 spec, and the existing code/tests in `docs/module-registry.md`.
- This document specifies a fallback. It authorizes no runtime implementation, AWS API call, deployment, model invocation, Terraform apply, commit, or push.
- Amazon Bedrock AgentCore Runtime remains **BLOCKED**. Its `CreateAgentRuntime` returned `AccessDenied` repeatedly in `ap-northeast-1`; the diagnostic retry still failed after the three create/tag actions were temporarily allowed on `*` without conditions. The policy was restored, with normalized live/backup SHA-256 `f0071104a1c316eddbf40d87bf50a817fa62149f88dbfcb775cfb4294e1f8bca`. The last diagnostic stack ID ends in `3b731a60-bb46-11f1-bd02-0a904b569985`, OperationId `3b7898a0-bb46-11f1-bd02-0a904b569985`, and reported RequestToken is `712e7cf5-24c4-62ab-b1d3-f5a34ee75473`. These observations do not establish the denied internal action. Loop 017B success must not be described as an AgentCore fix.

## Purpose

Demonstrate one real, approved Amazon Bedrock Nova 2 Lite inference from a minimal AWS Lambda wrapper using a fixed synthetic prompt and a synthetic no-op tool. Convert only wrapper-observed facts into a Normalized Agent Event, then use the existing mapper and `EvidenceProcessingService` to exercise `Evidence → Schema → Sign → Store → Ledger`, followed by Store reload and signature/tamper verification. Keep normal development and CI AWS-free.

## Requirements

1. **Fixed input:** The model prompt, tool specification, target URI, and allowed tool arguments are versioned constants. The manual Lambda request may carry only a generated correlation/run ID; it cannot supply arbitrary prompt, customer data, model ID, tool target, or credentials. The handler rejects unexpected fields.
2. **One inference maximum:** After a separate human GO, one synchronous Lambda invocation may issue at most one non-streaming `Converse` request to `jp.amazon.nova-2-lite-v1:0` from `ap-northeast-1`. SDK and invoking-client automatic retries are disabled. There is no automatic event source, Function URL, API Gateway, EventBridge, queue, or other invocation trigger. G4 authorizes exactly one intended human-approved synchronous invocation. The handler never makes a second model call to submit a tool result. If the outcome is ambiguous, stop and mark it `INDETERMINATE`; do not retry under the same approval.
3. **Synthetic tool:** The handler accepts exactly one expected `toolUse` for the allowlisted no-op tool and validates its arguments against the fixed synthetic target. It executes no external write. Zero, multiple, malformed, or different tool requests fail closed. The audit event reports the action and side effect that actually occurred, not a model-generated claim of an external write.
4. **Trusted envelope:** The Lambda wrapper generates the `auditEvent` from the validated tool use, fixed policy/approval facts, actual invocation IDs, and returned Bedrock request metadata. Raw model text and arbitrary model-provided fields are not mapped to Evidence. The collector validates the normalized-event contract and invocation correlation before processing.
5. **Canonical path:** Reuse `schemas/normalized-agent-event.schema.json`, `lib/ai-agent-evidence-mapper.js`, `schemas/ai-agent-evidence.schema.json`, and `lib/evidence-processing-service.js`. Preserve Schema → Sign → Store → Ledger order. Reload the stored version only after Ledger success; check identity/version/digest and signature, then verify a tampered clone fails.
6. **Data minimization:** No real PII, secrets, credentials, private keys, raw prompt, raw model response, or unvalidated tool input may enter Evidence, summaries, fixtures, logs, or retained artifacts. Reject events marked as containing personal data or secrets before signing. Retain only allowlisted correlation IDs, model/profile ID, request IDs, usage counts, code/input digests, Evidence digest, stage status, and verification status.
7. **Live AWS proof:** A later approved run must capture a Lambda request ID, Bedrock request ID, time window, executing role, model/profile ID, sanitized outcome, and matching CloudTrail `Converse` event. CloudTrail/runtime logs are independent execution observations; they are not themselves signed Evidence or proof that the model's statements were true.
8. **Isolation:** Keep all existing AgentCore Loop 017 code, evidence, governance files, and history unchanged. Add Loop 017B files and status documentation rather than rewriting previous results. Do not alter the frozen AgentCore S3 deployment inputs or existing AgentCore IAM roles.
9. **Minimal footprint:** Use 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda: one Lambda function, one dedicated execution role, its inline policy, and one short-retention CloudWatch log group. No VPC/NAT, API Gateway, Function URL, EventBridge, queue, database, provisioned throughput, new KMS key, or persistent evidence bucket is required for this portfolio demonstration. Reserved concurrency is not configured because the reported account quota of 10 must remain unreserved. Production deployment must restore technical concurrency/idempotency protection; the one-off PoC relies on the human one-shot approval boundary and does not prevent a second authorized manual request. Evidence processing may use the existing local ECDSA and local demo Store/Ledger boundaries; it must not claim PostgreSQL durability or production completeness.

## Invariants

- Keep `Evidence → Schema → Sign → Store → Ledger`; verify a reloaded record only after Ledger success.
- Do not treat model prose, Lambda logs, or CloudTrail alone as signed or truthful Evidence.
- Preserve AgentCore Loop 017 evidence/history and its `BLOCKED` status.
- Keep default development AWS-free and require separate deployment and inference approvals.

## Acceptance Criteria

- [ ] Approved source and clean working tree are confirmed immediately before future implementation; no source is taken from the older remote `0088a205...` tip by accident.
- [ ] Offline tests prove fixed-input enforcement, one `Converse` call maximum, no retry, exactly one expected tool use, no external side effect, invalid-response rejection, and no raw-content persistence.
- [ ] Offline end-to-end tests prove normalized-event and Evidence-schema validation, complete semantic mapping, Schema → Sign → Store → Ledger order, post-Ledger reload `PASS`, and tampered verification `FAIL`; failure paths fail closed.
- [ ] IAM and Terraform plans are reviewed for the 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda and scoped permissions; local structure/security checks and independent review pass before a deployment decision.
- [ ] A separate deployment GO is received before creating AWS resources. Deployment itself performs no Nova inference.
- [ ] A further, separate one-shot inference GO is received after deployed code digest, fixed input digest, principal, Region/profile, cost ceiling, and cleanup plan are reviewed.
- [ ] The observed run has one matching successful Bedrock `Converse` event, one Lambda execution, one synthetic no-op tool execution, and a sanitized Evidence summary whose reloaded signature passes and tampered clone fails. Any missing/ambiguous count or mismatch is not a PASS.
- [ ] AgentCore is still recorded as `BLOCKED`, its prior evidence/history is untouched, and the Lambda result is labeled as Loop 017B fallback evidence only.

## Open Questions

None for the local specification. Current inference-profile destinations and account access are read-only preflight gates before any deployment approval.

## Review Gate

No production ingestion, real customer data, external side effects, AgentCore retry, AgentCore remediation, persistent AWS Store/Ledger, external anchor, automated deployment, or automatic live test is in scope. True exactly-once behavior across an ambiguous network failure would need durable idempotency state; this minimal design instead enforces at-most-one intentional request and stops on ambiguity. This spec alone gives **NO-GO** for deployment and Nova invocation.
