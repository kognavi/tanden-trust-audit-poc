# Phase 2 AWS-Backed MVP Non-Goals

## Purpose

This document defines what Phase 2 intentionally does not attempt to solve.

The goal is to keep the AWS-backed MVP small, reviewable, and aligned with the current prototype stage.

## Non-Goals

### NG-1 Production Certification

Phase 2 is not intended to produce a production-certified audit platform.

It does not attempt to provide legal, regulatory, or compliance certification.

### NG-2 Full Enterprise Multi-Tenant SaaS

Phase 2 does not attempt to implement:

- Organization management
- Tenant isolation
- Role-based administration UI
- Billing
- Subscription management
- Enterprise onboarding

### NG-3 Full Blockchain Integration

Phase 2 does not attempt to anchor evidence hashes to a public blockchain.

Blockchain anchoring may be considered in a later phase after AWS-backed verification is stable.

### NG-4 Full Immutability Guarantees

Phase 2 does not require full immutability through mechanisms such as:

- S3 Object Lock in compliance mode
- QLDB-style append-only ledgers
- Public blockchain anchoring
- External timestamp authorities

These may be evaluated later.

### NG-5 Full Incident Response Platform

Phase 2 does not attempt to build a full incident response or case management system.

It focuses only on evidence integrity and verification workflow.

### NG-6 Full Web Application

Phase 2 does not require a production web UI.

CLI-first workflows remain acceptable for the prototype.

### NG-7 Full CI/CD Deployment Pipeline

Phase 2 does not require a complete production-grade CI/CD pipeline.

Basic scripts or IaC skeletons are acceptable if introduced.

### NG-8 Real Sensitive Evidence Data

Phase 2 should not use real personal data, confidential business data, or regulated data.

Synthetic sample evidence should remain the default.

### NG-9 Advanced Key Lifecycle Management

Phase 2 does not require a complete key lifecycle design, including:

- Automated key rotation policy
- Cross-account key sharing
- External key stores
- Hardware security module customization
- Formal key ceremony

Basic AWS KMS usage or design documentation is sufficient for the prototype.

### NG-10 Formal Threat Model Completion

Phase 2 does not require a complete formal threat model.

However, changes that affect trust boundaries should identify whether the threat model needs future updates.

## Explicitly Deferred Topics

The following topics are deferred to later phases:

- Public blockchain anchoring
- S3 Object Lock compliance mode
- Multi-account AWS architecture
- Production IAM permission boundaries
- Full audit reporting UI
- External auditor workflows
- Formal compliance mapping
- Long-term evidence retention policy
- Cross-region disaster recovery
- Enterprise-grade observability

## Rationale

Keeping these items out of Phase 2 allows the project to focus on the core question:

Can the local tamper-evident verification model be extended into a minimal AWS-backed architecture without losing its trust semantics?

## Exit Check

A proposed Phase 2 task should be reconsidered if it requires:

- Real customer data
- Production compliance claims
- Always-on infrastructure
- Full SaaS account management
- Public blockchain anchoring
- Large irreversible architecture decisions
