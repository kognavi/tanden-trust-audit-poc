# Documentation Index

This directory contains design documents, security analysis, and process
documentation for the Tanden Trust Audit PoC.

## Start Here

| Document | Description |
|---|---|
| `roadmap.md` | Project phase status and plan |
| `portfolio-summary.md` | Product-oriented project summary for recruiters/reviewers |
| `verification-runbook.md` | Step-by-step reviewer verification guide |

## Current Design

| Document | Description |
|---|---|
| `threat-model.md` | Current threat model: assets, trust boundaries, threat actors, STRIDE mapping, residual risks |
| `signature-provider-design.md` | Current signature provider architecture (`lib/signature.js`) |
| `aws-s3-integration-test.md` | Gated real AWS S3 integration test design |
| `local-verification-result.md` | Local verification test results |

## Future / Production Design

| Document | Description |
|---|---|
| `kms-signing-design.md` | Future AWS KMS signing design (supersedes `aws-kms-signing-design.md`) |
| `aws-kms-key-management-design.md` | Future AWS KMS key management design (rotation, IAM policy) |
| `aws-reference-architecture.md` | Future full AWS production architecture |
| `attack-scenarios.md` | Extended attack scenario catalog, including future/unimplemented controls (IAM, KMS, CI/CD) |

## Architecture & Design Background

| Document | Description |
|---|---|
| `architecture.md` | High-level architecture overview |
| `architecture-diagram.md` | Diagram source |
| `aws-architecture.md` | AWS-specific architecture notes |
| `audit-design.md` | Audit design principles |
| `audit-procedures.md` | Audit procedure descriptions |
| `control-mapping.md` | Control-to-evidence mapping |
| `evidence-lifecycle.md` | Evidence lifecycle stages |
| `framework-selection.md` | Rationale for tool/framework choices |

## ADRs (Architecture Decision Records)

| Document | Decision |
|---|---|
| `adr/0001-digest-metadata-storage.md` | Digest and metadata storage approach |
| `adr/0002-s3-json-object-store.md` | S3 JSON object store design |

## Phase 2 (AWS) Planning

| Document | Description |
|---|---|
| `phase-2-aws/requirements.md` | Requirements |
| `phase-2-aws/design.md` | Design |
| `phase-2-aws/tasks.md` | Task breakdown |
| `phase-2-aws/acceptance-criteria.md` | Acceptance criteria |
| `phase-2-aws/non-goals.md` | Explicit non-goals |

## Project History

| Document | Description |
|---|---|
| `progress-summary.md` | Project background and history |

## Historical / Superseded

| Document | Superseded by |
|---|---|
| `security.md` | `threat-model.md` |
| `aws-kms-signing-design.md` | `kms-signing-design.md` |

## Review Packet

| Document | Description |
|---|---|
| `ai-review-packet-v0.1.0.md` | AI-assisted review packet for v0.1.0 |
