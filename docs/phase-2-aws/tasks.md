# Phase 2 AWS-Backed MVP Task Plan

## Purpose

This document breaks the Phase 2 AWS-backed MVP into small, reviewable tasks.

The goal is to preserve the current small-PR workflow while using the Phase 2 planning documents as the upper-level roadmap.

## Task Principles

- Keep each PR focused on one design or implementation concern
- Prefer docs and interfaces before live AWS integration
- Preserve existing local MVP behavior
- Add tests before or with behavior changes
- Avoid large AI-generated code drops

## Proposed Task Breakdown

| Priority | Task | Type | Rationale |
|---|---|---|---|
| P0 | Update README for non-mutating tamper demo | Docs | Align docs with PR #48 behavior |
| P0 | Add JCS canonicalization edge case tests | Testing | Strengthen core integrity guarantee |
| P0 | Add Phase 2 AWS planning docs | Docs | Define AWS roadmap before implementation |
| P1 | Add ADR for expected digest trust boundary | Docs / Architecture | Clarify trust anchor assumptions |
| P1 | Add ADR for KMS signing boundary | Docs / Architecture | Define what is signed and verified |
| P1 | Introduce storage provider interface | Code | Prepare local and AWS storage implementations |
| P1 | Introduce digest metadata provider interface | Code | Prepare sidecar, DynamoDB, or signed metadata options |
| P2 | Add local file-based storage provider tests | Testing | Preserve local reproducibility |
| P2 | Add AWS S3 storage design or mock provider | Code / Design | Prepare AWS integration without live dependency |
| P2 | Add KMS provider contract tests | Testing | Define behavior before live KMS use |
| P3 | Add minimal IaC skeleton | IaC | Provide reproducible AWS resources |
| P3 | Add CloudTrail / logging design | Docs / AWS | Improve auditability |
| P4 | Add live AWS integration demo | AWS / Demo | Demonstrate end-to-end AWS-backed verification |

## Suggested PR Sequence

### PR 1

docs: add phase 2 AWS planning docs

Files:

- `docs/phase-2-aws/requirements.md`
- `docs/phase-2-aws/design.md`
- `docs/phase-2-aws/tasks.md`
- `docs/phase-2-aws/acceptance-criteria.md`
- `docs/phase-2-aws/non-goals.md`

### PR 2

docs: update README for non-mutating tamper demo

Purpose:

- Align README with `npm run demo:tamper` behavior after PR #48

### PR 3

test: add canonicalization edge case coverage

Purpose:

- Add tests for JCS-relevant edge cases

### PR 4

docs: add ADR for digest trust boundary

Purpose:

- Clarify how expected digests are trusted in local and AWS-backed MVPs

### PR 5

docs: add ADR for KMS signing boundary

Purpose:

- Define whether KMS signs canonical JSON bytes, SHA-256 digest, or structured metadata

## Notable Dependencies

- KMS signing design depends on the digest/signing boundary decision
- AWS storage provider design depends on metadata storage decision
- IaC skeleton should follow service selection
- Live AWS integration should come after local tests and provider interfaces

## Review Checklist for Each PR

- Is the PR small and focused?
- Does the PR preserve existing behavior?
- Are trust boundaries affected?
- Are tests or verification commands included?
- Does the README or runbook need updates?
- Does the threat model need an update?
