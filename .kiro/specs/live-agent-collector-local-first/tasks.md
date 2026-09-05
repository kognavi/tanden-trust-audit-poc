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

- [ ] Select one AWS-oriented Agent runtime.
- [ ] Capture one real tool-call event.
- [ ] Map it through the same normalized event contract.
- [ ] Produce Evidence.
- [ ] Verify Evidence.
- [ ] Tamper and verify failure.
- [ ] Record a non-sensitive demo result.
- [ ] Clean up any billable resources.

## Non-Goals

- SaaS hosting
- persistent production database
- multi-tenant control plane
- always-on monitoring stack
- production throughput
