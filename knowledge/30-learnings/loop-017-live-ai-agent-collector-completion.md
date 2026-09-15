---
id: learning-loop-017-live-ai-agent-collector-completion
type: learning
status: draft
created: 2026-09-15
updated: 2026-09-15
source:
  - knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md
  - .kiro/specs/loop-017-live-ai-agent-collector-completion/design.md
  - lib/agentcore-live-demo.js
supports:
  - context-pack-loop-017-live-ai-agent-collector-completion
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 017 - Live AI Agent Collector Completion Learning

## What became clearer

- Capturing the object passed to `appendEvidence()` proves processor input, not successful reload of the stored version. A complete demo needs an explicit Store read after Ledger completion.
- Fixture and live adapters should converge before Evidence construction. Reusing the same Normalized Agent Event schema and mapper avoids a live-only trust path.
- Session and trace correlation belong at ingress, while Evidence identity/version/digest checks belong at the reload boundary.
- A defensive clone on Store append and reload makes it possible to demonstrate tamper detection without mutating the stored record itself.
- `containsSecrets: false` is already enforced by the Normalized Agent Event schema; the live application keeps an additional pre-processing guard so a future schema change cannot silently permit secret-bearing demo Evidence.

## Accepted trade-offs

- The controlled demonstration uses an append-only in-memory Store and deterministic Ledger test double rather than PostgreSQL. This keeps default execution AWS-free and database-free while exercising the production `EvidenceProcessingService` ordering contract.
- Stage names are included in the sanitized summary as control-flow evidence; Evidence bodies, signatures, keys, Runtime ARN, prompts, and model text remain excluded.
- A local PASS establishes implementation readiness only. It does not claim that AgentCore, Bedrock model invocation, OIDC credentials, or an existing Runtime worked in AWS.

## Validation boundary

- Local fixtures can prove normalized mapping, Schema → Sign → Store → Ledger order, reload verification, and tamper failure deterministically.
- Only a separately approved one-shot AgentCore invocation can supply observed live AWS evidence.
- No deploy, resource creation, IAM/KMS mutation, production data, or persistent AWS service is required by the local completion work.

## Next action

After independent Reviewer, Security Reviewer, and Verification Evidence PASS, stop at `HUMAN_AWS_DEMO_DECISION` and present the exact one-shot invocation cost, identity, region, resources, data, and cleanup boundary.
