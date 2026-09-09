---
id: loop-007-verification-evidence-gate
type: idea
status: inbox
created: 2026-09-09
updated: 2026-09-09
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 007 - Verification & Evidence Gate

## Goal

Implementation Conformance後の検証結果を、第三者が追跡できるmachine-readable Evidence Packとして固定し、merge判断の根拠を標準化する。

## Gate Conditions

- Spec Readiness PASS
- Implementation Handoff存在
- Implementation Conformance PASS
- `npm run check:structure` PASS
- changed files / sensitive files / provenanceをEvidence Packへ記録
- sensitive path変更時はsecurity review artifactを要求
- Evidence PackにSHA-256 digestを付与
- PR templateにVerification Evidence欄を追加

## Constraints

- production deploy / mergeを自動実行しない
- AWS API / external AI APIを使わない
- digestはintegrity signalでありauthenticity proofではない
- semantic correctnessやHuman judgmentを置き換えない
