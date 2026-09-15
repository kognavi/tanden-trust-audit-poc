# loop-017-live-ai-agent-collector-completion Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- Context ID: `context-pack-loop-017-live-ai-agent-collector-completion`

## Purpose

Amazon Bedrock AgentCoreの1回の合成tool-call responseを、既存local-first canonical pathでNormalized Agent EventからAI Agent Evidenceへ変換し、Schema → Sign → Store → internal Ledger完了後にStoreから再読込して署名と改ざん検知を検証できる状態にする。

## Current Implementation Truth

- Fixture collectorとAgentCore collectorは同じNormalized Agent Event schemaおよびmapperを使用する。
- AgentCore collectorはvalidated `auditEvent`のみを抽出し、session/trace correlation mismatchをEvidence処理前に拒否する。
- `EvidenceProcessingService`は既にSchema → Sign → Store → Ledgerを順序どおり実行する。
- 現在のlive demoはappend時にcaptureした値を検証しており、Store reload後のrecordを検証していない。
- Runtime appとmanual workflowは既に合成データ限定、1回invocation、raw request/response削除の境界を持つ。実AWS invocationは未実施である。

## Requirements

- [x] Existing fixture/local collector and mapper path remains the canonical baseline and stays green.
- [x] Live AgentCore response uses `BedrockAgentCoreCollector` → existing normalized schema → existing mapper → `EvidenceProcessingService`; no live-only Evidence construction is introduced.
- [x] Actor, agent, model, execution, policy, tool/action, approval, side-effect, references, artifacts, and metadata mappings are preserved without semantic loss.
- [x] `Evidence → Schema → Sign → Store → Ledger` remains unchanged; reload verification occurs only after Ledger append succeeds.
- [x] The local demo Store provides append-only identity/version semantics and an explicit `getEvidenceVersion(evidenceId, version)` reload boundary.
- [x] The live demo verifies the signature of the reloaded Evidence record and confirms the reloaded evidence ID, version, and digest match the canonical processing result.
- [x] Missing, malformed, identity-mismatched, digest-mismatched, signature-invalid, or tampered reload records fail closed.
- [x] A tampered clone of the reloaded Evidence fails signature verification without mutating the stored record.
- [x] Events marked as containing personal data or secrets fail before Schema/Sign/Store/Ledger processing.
- [x] Raw prompt, top-level model response, credentials, Runtime ARN/account ID, secret material, and unnecessary PII are excluded from Evidence, stored record summaries, logs, fixtures, and demo output.
- [x] Sanitized output records canonical stage completion and reload verification without exposing raw Runtime data or key material.
- [x] Regression tests cover live adapter correlation, mapping parity, processing order, reload verification, data minimization, and tamper/failure paths.
- [x] Runtime application, live workflow, IAM/CDK, and AWS resources remain unchanged unless a verified blocker requires a separately reviewed change.
- [x] Security Reviewer is mandatory and independent.

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger`; reload is a read/verification after Ledger completion.
- Do not bypass normalized schema validation, AI Agent Evidence schema validation, signing, storage, or ledger append.
- Do not trust caller-supplied verification booleans or arbitrary hashes.
- Do not persist raw prompts, model text, secrets, credentials, unnecessary PII, or private key material.
- Default execution remains AWS-free and deterministic.
- Preserve prior Loop artifacts and do not modify Loop 015/016 evidence.

## Acceptance Criteria

- [x] Existing four focused test files pass before and after implementation.
- [x] New tests prove the live response follows Store append → Ledger append → Store reload → signature verification.
- [x] New tests prove full actor/agent/model/policy/tool/approval/side-effect mapping parity.
- [x] New tests prove secret/PII rejection and reload identity/digest/signature tamper fail closed.
- [x] Spec Readiness, Implementation Conformance, architecture checks, focused tests, full suite, independent Reviewer, independent Security Reviewer, Verification Evidence, and `git diff --check` pass.
- [x] No AWS invocation, deploy, IAM/KMS mutation, persistent resource creation, blockchain/external anchor, push, PR, or merge occurs.
- [x] After all local gates pass, the process stops at `HUMAN_AWS_DEMO_DECISION` because one real invocation is still needed to claim an observed live AWS demonstration.

## Open Questions

None.

## Review Gate

This Spec authorizes local code, deterministic test doubles/tests, current-state documentation, and governance artifacts only. It does not authorize an AWS API call, deployment, resource mutation, external anchoring, push, PR, or merge.
