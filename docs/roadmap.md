# Roadmap

## Strategic Direction

The project is now positioned as an **AI Agent Evidence Layer** on AWS.

Blockchain/Web3 remains an optional external trust mechanism rather than the primary product boundary.

The next milestones prioritize market validation and live AI-agent evidence collection over adding more cryptographic components.

The implementation policy is **Local-first / AWS-on-demand**. Normal development and CI should not make real AWS calls. A real AWS run is used only for short, explicit portfolio demonstrations.

## Completed Foundation

### Local evidence integrity

- JSON Schema validation
- RFC 8785 JCS canonicalization
- SHA-256 tamper detection
- local signatures
- signed sidecar metadata
- automated tests

### AWS-oriented authenticity and storage

- S3-compatible object store
- `AwsKmsProvider`
- PostgreSQL versioned evidence store
- PostgreSQL signing-event hash chain
- `EvidenceProcessingService`
- real/fake integration test separation
- S3 Object Lock Terraform module
- AWS Budgets cost guardrail

### Security engineering

- threat model
- STRIDE mapping
- attack scenarios
- ADRs
- verification runbook
- CodeQL
- Semgrep
- Dependabot
- architecture checks

### External proof prototype

- `VerifiedAnchorService`
- `TrustAnchor.sol`
- Ethereum Sepolia digest anchoring

## Phase A: AI Agent Evidence Profile

Status: **Implemented**

Deliverables:

- `schemas/ai-agent-evidence.schema.json`
- `samples/ai-agent-tool-call.json`
- `tests/ai-agent-evidence-schema.test.js`
- `docs/ai-agent-evidence-profile.md`

Goal:

Define the minimum security-relevant context required to reconstruct and verify an AI agent action without storing raw secrets or sensitive payloads by default.

## Phase B: Live Runtime Collector

Status: **Next**

Implementation policy: **Local-first**. Build and test the collector with fixtures and local/fake dependencies first. Add one manually triggered AWS demo only after the local path is complete.

Goal:

Connect one real AI agent runtime to the evidence pipeline.

Candidate scope:

- fixture-based collector and normalized event contract first
- AWS Bedrock AgentCore or another AWS-oriented agent runtime as a later manual demo adapter
- one security-relevant tool call
- actor/agent/model/policy/tool/approval/side-effect mapping
- no raw secrets or unnecessary PII
- process through `EvidenceProcessingService`

Acceptance criteria:

1. capture one synthetic/fixture tool-call event locally
2. convert it into the AI Agent Evidence profile
3. validate it
4. sign it locally
5. persist it with local/test dependencies
6. append ledger event
7. verify it after reload
8. tamper with evidence and show verification failure
9. manually capture one real AWS tool-call event
10. run the same mapping path and preserve a non-sensitive demo record

Cost constraints:

- no real AWS calls in default CI
- no persistent RDS/Aurora
- no NAT Gateway
- no always-on ECS/EC2
- no OpenSearch
- no provisioned model throughput
- real AWS validation must be manual and time-bounded

Legacy acceptance criteria below are superseded by the local-first sequence above.

1. capture one real tool-call event
2. convert it into the AI Agent Evidence profile
3. validate it
4. sign it
5. persist it
6. append ledger event
7. verify it after reload
8. tamper with evidence and show verification failure

## Phase C: Auditor-Facing Evidence Bundle

Status: Planned

Goal:

Produce a reviewable evidence packet for a single agent action.

Include:

- evidence record
- digest
- signature metadata
- signer/KMS key reference
- version
- ledger event reference
- policy/approval references
- verification result
- provenance references

The bundle should be understandable by security, internal audit, compliance, or incident response practitioners without reading application source code.

## Phase D: AWS Production Hardening

Status: Planned

Priority items:

- real AWS KMS + PostgreSQL integration coverage
- production IAM/key policy and separation of duties
- S3 Object Lock deployment and retention operations
- CloudTrail/CloudWatch correlation
- backup/HA and recovery
- evidence retention lifecycle
- operational alerts
- incident response runbook

## Phase E: Completeness and Reconstruction

Status: Planned

Goal:

Move beyond tamper detection to evidence-set completeness.

Explore:

- monotonic sequence numbers
- chain-head checkpoints
- Merkle trees
- missing-event detection
- cross-system correlation IDs
- reconciliation queues

## Phase F: Control Mapping and Customer Validation

Status: Planned

Do not claim formal compliance mapping until validated with practitioners.

Research targets:

- AI Agent / SaaS operators
- internal audit
- compliance
- security engineering
- cloud governance
- regulated SaaS / FinTech teams

Key questions:

- what evidence is requested after an agent action?
- which evidence is difficult to reconstruct today?
- what retention period is required?
- what data cannot be stored in audit evidence?
- who owns the budget?
- what would trigger a paid PoC?

## Phase G: Optional External Trust Anchoring

Status: Prototype exists

External anchoring remains optional.

Possible mechanisms:

- public blockchain
- transparency log
- trusted timestamp service

Selection should be driven by customer trust requirements, not by technology preference.

## Current Priority Order

1. local-first AI Agent collector and mapper
2. one manual live AWS demonstration
3. auditor-facing evidence bundle
4. practitioner interviews / design partners
5. AWS production hardening
6. completeness/gap verification
7. control-framework mapping
8. optional external anchor hardening

Detailed implementation spec: `.kiro/specs/live-agent-collector-local-first/`

Previous ordering retained below for history.

1. AI Agent runtime collector
2. auditor-facing evidence bundle
3. practitioner interviews / design partners
4. AWS production hardening
5. completeness/gap verification
6. control-framework mapping
7. optional external anchor hardening
