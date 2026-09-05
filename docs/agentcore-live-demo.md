# Amazon Bedrock AgentCore Live Demo

## Purpose

Phase B-2 proves that one **real Amazon Bedrock AgentCore Runtime invocation** can feed the same runtime-neutral Evidence pipeline implemented in Phase B-1.

The live demo is intentionally narrow:

```text
Amazon Bedrock AgentCore Runtime
        ↓
one configured synthetic tool call
        ↓
JSON response containing auditEvent
        ↓
BedrockAgentCoreCollector
        ↓
Normalized Agent Event
        ↓
AI Agent Evidence Mapper
        ↓
EvidenceProcessingService
        ↓
Local ECDSA → local/test Store → local/test Ledger
        ↓
Verify PASS
        ↓
Tamper
        ↓
Verify FAIL
```

The AWS boundary ends at the Runtime invocation. Evidence processing remains local for this portfolio demo, so the workflow does not create RDS, S3, KMS, NAT Gateway, ECS, or other persistent infrastructure.

## Selected Runtime

The selected live runtime is **Amazon Bedrock AgentCore Runtime**.

The default Region for this portfolio workflow is `ap-northeast-1` (Tokyo), but the workflow input is configurable.

The repository does not auto-deploy a Runtime. Deployment is a separate explicit human action because it creates an AWS resource.

## Runtime Response Contract

The configured demo agent must return JSON containing an `auditEvent` that satisfies:

- `schemas/normalized-agent-event.schema.json`

Example envelope:

```json
{
  "result": "human-readable result that the collector ignores",
  "auditEvent": {
    "eventType": "AGENT_TOOL_CALL"
  }
}
```

The audit event should be created by the trusted tool execution path or application wrapper, not reconstructed from free-form model prose after the fact.

The collector deliberately ignores all top-level model text and persists only the validated `auditEvent`.

## Correlation Binding

The workflow creates:

- `runtimeSessionId`
- `traceId`

The returned `auditEvent.execution.sessionId` and `auditEvent.execution.traceId` must match those invocation values. A mismatch fails closed before Evidence processing.

AgentCore Runtime requires a runtime session identifier of at least 33 characters. The workflow uses a UUID.

## Data Minimization

The manual portfolio demo rejects:

- raw prompt fields outside the Normalized Agent Event contract
- secret-bearing Evidence
- events marked `containsPersonalData: true`

The raw Runtime response is processed only on the ephemeral GitHub Actions runner and is deleted before the job ends.

The sanitized summary contains only:

- Region and qualifier
- SHA-256 digest of the Runtime ARN, not the ARN itself
- session/trace correlation IDs
- Evidence ID
- tool/action summary
- Evidence digest
- verification PASS/FAIL results

## Manual Workflow

Workflow:

- `.github/workflows/agentcore-live-demo.yml`

Required inputs:

1. `confirm_cost = RUN`
2. an existing AgentCore Runtime ARN
3. qualifier, normally `DEFAULT`
4. Region, default `ap-northeast-1`

The workflow uses the repository's existing OIDC role secret:

- `AWS_GITHUB_ACTIONS_ROLE_ARN`

The role must allow the selected Runtime invocation:

- `bedrock-agentcore:InvokeAgentRuntime`

## Cost Boundary

The workflow:

- is `workflow_dispatch` only
- performs exactly one Runtime invocation
- has a 10-minute timeout
- creates no database or network infrastructure
- does not run on PR or push
- deletes the raw Runtime request/response from the runner
- uses local signing/storage/ledger test doubles after the AWS invocation

This is a billable AWS call and should only be run intentionally.

## One-Time Runtime Preparation

Use an official AgentCore-supported deployment path to create a tiny demo Runtime with one synthetic tool.

The tool should perform only a synthetic side effect and return the sanitized `auditEvent` envelope described above.

Do not point this portfolio demo at production systems or real customer data.

After the demonstration, the Runtime can be removed if it is no longer needed. The portfolio proof is the successful GitHub Actions run and the sanitized summary.

## Status

The repository contains the collector, processor, tests, and manual workflow.

The actual AWS Runtime invocation remains pending until an AgentCore Runtime ARN is explicitly supplied by the human operator.
