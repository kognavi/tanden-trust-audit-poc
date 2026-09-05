# Documentation Index

This directory contains design, security, audit, and product-facing documentation for Tanden Trust Audit PoC.

## Start Here

| Document | Description |
|---|---|
| `ai-agent-evidence-profile.md` | AI-agent-specific evidence model and security properties |
| `portfolio-summary.md` | Recruiter/customer-facing project summary |
| `architecture.md` | Current and target architecture |
| `architecture-diagram.md` | Product, current, and target diagrams |
| `roadmap.md` | Product-oriented next steps |
| `agentcore-live-demo.md` | Manual one-shot Amazon Bedrock AgentCore evidence demo contract |
| `cost-guardrails.md` | Local-first / AWS-on-demand cost policy |
| `verification-runbook.md` | Reviewer verification guide |

## Security and Audit

| Document | Description |
|---|---|
| `threat-model.md` | Threat model, STRIDE, residual risks |
| `attack-scenarios.md` | Practical attack scenario catalog |
| `control-mapping.md` | Control-to-evidence mapping |
| `audit-procedures.md` | Audit procedure descriptions |
| `evidence-lifecycle.md` | Evidence lifecycle |
| `audit-design.md` | Audit design principles |

## AWS and Production-Oriented Design

| Document | Description |
|---|---|
| `aws-reference-architecture.md` | Production-oriented AWS reference architecture |
| `kms-signing-design.md` | AWS KMS signing design |
| `aws-kms-key-management-design.md` | Key management and IAM design |
| `aws-s3-integration-test.md` | Gated real AWS S3 test design |
| `phase-2-aws/` | Historical AWS-backed MVP planning |

## Architecture Decision Records

| Document | Decision |
|---|---|
| `adr/0001-digest-metadata-storage.md` | Digest and metadata storage |
| `adr/0002-s3-json-object-store.md` | S3 JSON object store |
| `adr/0003-s3-object-lock-consideration.md` | S3 Object Lock decision |
| `adr/0004-signing-event-ledger.md` | PostgreSQL signing ledger |

## Implementation Index

- `module-registry.md`: current module/export registry
- `local-verification-result.md`: local verification record
- `progress-summary.md`: historical project background

## Historical / Supporting

- `framework-selection.md`
- `ai-review-packet-v0.1.0.md`
- `security.md` (superseded by threat model)
- `aws-kms-signing-design.md` (superseded by kms-signing-design)
