# Tasks: Local-First Live Agent Collector

## Phase B-0: Cost Guardrails

- [x] Remove real AWS integration from default CI.
- [x] Add manual-only AWS integration workflow.
- [x] Add repository cost guardrails.
- [x] Update AGENTS.md with cost constraints.
- [x] Update README and roadmap with local-first policy.

## Phase B-1: Collector Skeleton

- [x] Add normalized Agent event contract.
- [x] Add fixture-based collector adapter.
- [x] Add AI Agent Evidence mapper.
- [x] Add unit tests for mapping and data minimization.
- [x] Add negative tests for missing policy/approval context.
- [x] Run through `EvidenceProcessingService` with local/test dependencies.

## Phase B-2: Manual Live AWS Demo

- [x] Select Amazon Bedrock AgentCore Runtime as the AWS-oriented Agent runtime.
- [ ] Capture one real AgentCore tool-call event by manually running the one-shot workflow.
- [x] Implement and test mapping of AgentCore response envelopes through the same normalized event contract.
- [x] Implement and test Evidence production from an AgentCore response fixture.
- [x] Implement and test local Evidence verification for the AgentCore adapter.
- [x] Implement and test tamper verification failure for the AgentCore adapter.
- [ ] Record a non-sensitive result from an actual AWS invocation.
- [ ] Clean up the manually created AgentCore Runtime after the proof, if it is no longer needed.

## Non-Goals

- SaaS hosting
- persistent production database
- multi-tenant control plane
- always-on monitoring stack
- production throughput
