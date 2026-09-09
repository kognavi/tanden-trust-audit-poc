---
id: loop-006-implementation-conformance
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

# Loop 006 - Implementation Conformance Gate

## Goal

Implementation Handoff後の実際の変更が、finalized Specの想定範囲から大きく逸脱していないかをPR前に機械検査する。

## Gate Conditions

- Spec Readiness PASS
- implementation-handoff.md存在
- changed filesがdesignのAffected Componentsに収まる
- sensitive path変更時にSecurity / Cost / Trust Boundary記載が存在
- Context Pack / Spec / Handoff provenanceが一致
- PR templateにConformance Gate欄がある

## Constraints

- コード意味論の完全一致は自動判定しない
- git diffはread-only
- merge/deployを自動実行しない
- AWS API / external AI APIを使わない
