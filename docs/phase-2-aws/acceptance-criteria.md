# Phase 2 AWS-Backed MVP Acceptance Criteria

## Purpose

This document defines the acceptance criteria for the Phase 2 AWS-backed MVP.

The goal is to make success measurable before implementation begins.

## Core Acceptance Criteria

### AC-1 Local MVP Behavior Is Preserved

The existing local workflows must continue to pass:

- npm test
- npm run demo
- npm run demo:tamper

### AC-2 Evidence Integrity Can Be Verified

Given a stored evidence record and trusted digest metadata, the system must return:

- VALID when the evidence content matches the expected digest
- INVALID when the evidence content has been modified

### AC-3 Evidence and Digest Metadata Have Separate Trust Boundaries

The design must clearly explain:

- Where evidence content is stored
- Where expected digest metadata is stored
- Which component is trusted
- How unauthorized modification is mitigated or detected

### AC-4 AWS Service Selection Is Documented

The Phase 2 design must document selected or candidate AWS services for:

- Evidence storage
- Digest metadata storage
- Signing or key management
- Operational logging
- Deployment or infrastructure management

### AC-5 Least Privilege Is Considered

The design must define least-privilege access principles for:

- Writing evidence
- Reading evidence
- Writing digest metadata
- Reading digest metadata
- Signing
- Verifying
- Reading logs

### AC-6 KMS Signing Boundary Is Defined

Before live KMS integration, the project must define whether AWS KMS signs:

- Canonical JSON bytes
- SHA-256 digest
- Structured metadata containing digest and evidence ID

### AC-7 Audit Trail Requirements Are Defined

The design must explain how to trace:

- Evidence write operations
- Digest metadata write operations
- Signing operations
- Verification operations
- Verification failures

### AC-8 Prototype Cost Remains Low

The proposed architecture should avoid always-on compute and unnecessary infrastructure.

### AC-9 Documentation Is Reproducible

A reviewer should be able to understand the intended Phase 2 workflow from the documentation alone.

## Demo Acceptance Criteria

A Phase 2 demo should eventually show:

1. Register or upload sample evidence
2. Store or register expected digest metadata
3. Verify original evidence as VALID
4. Verify modified evidence as INVALID
5. Show where relevant AWS audit logs would be inspected

## Test Acceptance Criteria

Phase 2 should include or preserve tests for:

- Untampered evidence verification
- Tampered evidence verification
- Wrong expected digest
- Missing evidence
- Missing digest metadata
- Signature verification success
- Signature verification failure after tampering
- Provider contract behavior if interfaces are introduced

## Documentation Acceptance Criteria

The following documents should remain aligned:

- README
- verification runbook
- threat model
- architecture documentation
- Phase 2 AWS planning docs
- ADRs for trust boundary decisions

## Exit Criteria

Phase 2 planning is considered complete when:

- Requirements are documented
- Non-goals are documented
- Candidate architecture is documented
- Task plan is documented
- Acceptance criteria are documented
- Open design decisions are listed
- Next implementation PRs can be created from the task plan
