# Tanden Trust Audit PoC

[![CI](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/ci.yml/badge.svg)](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/ci.yml)

**An audit-grade evidence layer for AI agent actions on AWS.**

The core question is simple:

> When an AI agent changes something important, can a reviewer later prove what happened, who or what authorized it, and that the evidence itself was not altered?

This repository is a technical PoC for turning security-relevant AI agent events into structured, tamper-evident evidence.

It combines:

- JSON Schema validation
- RFC 8785 JCS canonicalization
- SHA-256 digests
- local ECDSA and AWS KMS signing providers
- versioned PostgreSQL evidence storage
- a hash-chained signing ledger
- S3-compatible object storage
- an S3 Object Lock WORM Terraform module
- optional external anchoring through Ethereum Sepolia

Blockchain is intentionally treated as an **optional external trust anchor**, not as the primary product boundary.

---

## Why this exists

Runtime logs are useful, but a log line is not automatically audit evidence.

A reviewer may need to answer:

- Which human, service, or agent initiated the action?
- Which agent version and model configuration executed it?
- Which policy decision applied?
- Which tool or external system was targeted?
- Was human approval required?
- What side effect actually occurred?
- Which source documents or policy objects influenced the action?
- Has the resulting evidence changed since it was created?

This PoC explores how to preserve that context in a verifiable evidence record.

---

## Product Direction

The current portfolio direction is:

**AWS × AI Agent Security × Evidence Engineering**

The intended product boundary is an **AI Agent Evidence Layer** that sits between agent runtimes and audit/compliance workflows.

~~~text
AI Agent / SaaS
      ↓
Runtime collector / adapter           planned
      ↓
AI Agent Evidence envelope
      ↓
JSON Schema validation
      ↓
Cryptographic signing
      ↓
Versioned evidence storage
      ↓
Append-only signing ledger
      ↓
Immutable retention                   target
      ↓
External trust anchor                 optional
      ↓
Independent verification
~~~

The repository already implements the core evidence integrity pipeline. Live collectors for specific AI agent frameworks are the next product-oriented step.

---

## AI Agent Evidence Profile

The first AI-agent-specific profile is defined in:

- `schemas/ai-agent-evidence.schema.json`
- `samples/ai-agent-tool-call.json`
- `docs/ai-agent-evidence-profile.md`

It captures:

| Category | Examples |
|---|---|
| Actor | human, service, or agent identity |
| Agent | agent ID, version, prompt configuration digest |
| Model | provider, model ID, model version |
| Execution | trace ID, session ID, task ID |
| Policy | policy ID, version, allow/deny decision |
| Action | tool name, operation, target |
| Approval | required, status, reviewer, timestamp |
| Side effect | affected resource and outcome |
| Context references | policy, RAG document, tool-result references and digests |
| Artifacts | result, report, changeset, message references |
| Governance metadata | PII/secrets flags and retention class |

The profile favors **references and digests over raw prompts, secrets, or sensitive payloads**.

---

## Repository Trust Boundary

The architecture invariant is:

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

`EvidenceProcessingService` enforces that sequence for the production-oriented application path.

The external anchor is downstream of the core flow:

~~~text
Stored + signed evidence
        ↓
Off-chain verification
        ↓
Verified digest
        ↓
External anchor (optional)
~~~

This separation matters because immutability alone does not make an event true, authorized, complete, or compliant.

---

## What is implemented

### Evidence integrity

- JSON Schema validation
- RFC 8785 JCS-compatible canonicalization
- SHA-256 evidence digests
- tamper-detection tests
- local signature verification
- signed sidecar metadata verification

### AWS-oriented authenticity

- `AwsKmsProvider`
- AWS KMS asymmetric signing with `ECC_SECG_P256K1`
- KMS key-spec fail-fast validation
- physical KMS key ID propagation
- fake-client deterministic tests

### Evidence storage and ledger

- local JSON object store
- S3-compatible JSON object store
- PostgreSQL versioned evidence store
- PostgreSQL hash-chained signing ledger
- partial-failure reconciliation semantics in `EvidenceProcessingService`

### Security engineering

- threat model
- STRIDE analysis
- attack scenarios
- architecture decision records
- control mapping
- verification runbook
- CodeQL
- Semgrep
- Dependabot
- dependency-boundary checks
- GitHub Actions CI

### External proof prototype

- `TrustAnchor.sol`
- Ethereum Sepolia digest anchoring
- off-chain verification gate through `VerifiedAnchorService`
- no raw evidence or PII stored on-chain

---

## What is not implemented yet

This is a PoC, not a production SaaS.

Not yet complete:

- live Bedrock AgentCore / LangGraph / OpenAI / other runtime collectors
- production IAM and KMS separation-of-duties deployment
- production PostgreSQL provisioning, HA, backup, and role separation
- deployed S3 Object Lock retention policy
- CloudTrail / CloudWatch evidence correlation
- completeness proofs for missing or reordered evidence
- tenant isolation and SaaS control plane
- formal SOC 2, J-SOX, ISO 27001, or regulatory certification
- legal or audit opinion

The repository intentionally distinguishes **implemented controls** from **target architecture**.

---

## Security properties

| Property | Current PoC | Target |
|---|---|---|
| Integrity | implemented | hardened |
| Attribution | partial | identity-bound |
| Context | AI profile added | runtime-populated |
| Reconstruction | partial | cross-system correlation |
| Completeness | limited | sequence/gap verification |
| Verifiability | implemented locally | independent verifier |
| Minimization | profile-level design | policy-driven |
| Retention | Terraform module only | deployed WORM controls |

A cryptographic signature proves integrity/authenticity relative to a key. It does **not** prove that the original event was truthful.

---

## Quick verification

~~~bash
npm ci
npm run check:structure
~~~

Useful focused checks:

~~~bash
npm test
npm run validate:evidence
npm run hash
npm run verify
~~~

The default test suite does not require production AWS credentials.

---

## Key documents

Start with:

- [AI Agent Evidence Profile](docs/ai-agent-evidence-profile.md)
- [Architecture](docs/architecture.md)
- [Architecture Diagram](docs/architecture-diagram.md)
- [Threat Model](docs/threat-model.md)
- [Attack Scenarios](docs/attack-scenarios.md)
- [Control Mapping](docs/control-mapping.md)
- [Verification Runbook](docs/verification-runbook.md)
- [Portfolio Summary](docs/portfolio-summary.md)
- [Roadmap](docs/roadmap.md)

See [docs/README.md](docs/README.md) for the full documentation index.

---

## Portfolio summary

A concise description for recruiters, security engineers, auditors, and design partners:

> I built an AWS-oriented evidence integrity PoC for AI agent actions. The system validates structured evidence, canonicalizes it deterministically, signs it, stores versioned evidence, records signing events in a PostgreSQL hash chain, and supports later verification. I also designed immutable-retention, IAM/KMS, CloudTrail, and external-anchor hardening paths. The next step is connecting a live AI agent runtime to the evidence profile and validating the evidence requirements with audit, compliance, AI security, and SaaS practitioners.

The project is meant to demonstrate:

- AWS security architecture
- AI agent auditability
- evidence engineering
- cryptographic integrity design
- threat modeling
- DevSecOps
- audit/compliance-oriented system thinking

---

## License

MIT
