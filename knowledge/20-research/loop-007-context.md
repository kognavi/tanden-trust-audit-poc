---
id: loop-007-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-006-implementation-conformance.md
  - scripts/check-implementation-conformance.js
  - docs/implementation-conformance-gate.md
  - .github/pull_request_template.md
supports:
  - loop-007-verification-evidence-gate
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 007 Context

## Current gap

Loop 006でscope/provenance driftはPR前に検出できるようになったが、tests、conformance、security review signal、changed filesを一つの再利用可能なEvidence artifactへ固定していない。

## Decision

Loop 007ではdeterministicなVerification & Evidence Gateを追加する。

Gateは既存のImplementation Conformanceを再利用し、repository標準validationである `npm run check:structure` の結果と合わせてJSON Evidence Packを生成する。

## Security review rule

Implementation Conformanceがsensitive pathを検出した場合のみ、feature Spec directoryに `security-review.md` を要求する。

最低限以下を要求する。

- `Status: PASS`
- `Reviewed by:` のnon-empty value

これにより通常変更では過剰なceremonyを避けつつ、infra/workflow/IAM/KMS/Terraform/policy変更では独立review evidenceを残す。

## Evidence integrity

Evidence Pack payloadをstable JSON化し、SHA-256 digestを付与する。

これはartifactのaccidental/undetected modification検出には有効だが、署名ではないため作成者真正性は保証しない。
