---
id: loop-005-implementation-handoff
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

# Loop 005 - Implementation Handoff

## Goal

Spec Readiness Gateを通過したfeatureを、implementation branch/worktree、Developer作業、PR provenanceへ一貫した形でhandoffする。

## Expected Output

- READY Specだけを受け付けるhandoff CLI
- implementation-handoff.md
- 推奨branch名
- 推奨git worktree command
- Source Context Pack / Spec / Readiness provenance
- PR templateへのprovenance欄

## Constraints

- git branch/worktreeをスクリプトが勝手に作らない
- implementationを自動実行しない
- PRを自動mergeしない
- AWS resourceを追加しない
- external AI APIを使わない
- Human Approval gateを維持する
