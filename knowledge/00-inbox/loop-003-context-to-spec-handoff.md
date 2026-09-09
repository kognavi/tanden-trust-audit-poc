---
id: loop-003-context-to-spec-handoff
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

# Loop 003 - Context Pack to Spec Handoff

## Goal

Context PackをKiro/Codexのspec作成前入力として標準化し、Inbox → Context Pack → Specのhandoffを毎回同じ形で行えるようにする。

## Expected Output

- Context Pack pathを入力するCLI
- `.kiro/specs/<feature>/requirements.md`
- `.kiro/specs/<feature>/design.md`
- `.kiro/specs/<feature>/tasks.md`
- Context Pack由来であることが各specに明示される
- Architect / Developer agentがContext Pack-firstを守る

## Constraints

- Context Packはimplementation truthではない
- code / tests / module registryを優先する
- 自動実装はしない
- 自動mergeはしない
- AWS resourceを追加しない
- external AI APIを使わない
- Human review gateを残す
