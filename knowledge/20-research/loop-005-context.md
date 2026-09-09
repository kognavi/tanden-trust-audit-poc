---
id: loop-005-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-004-spec-readiness-gate.md
  - scripts/check-spec-readiness.js
  - AGENTS.md
  - .kiro/agents/developer.md
  - docs/ai-development-os.md
supports:
  - loop-005-implementation-handoff
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 005 Context

## Current state

Loop 004で `npm run spec:ready -- <feature-slug>` がimplementation開始前の最低条件になった。

ただしREADY後のbranch/worktree命名、Developerへのprovenance handoff、PRへのSource Context Pack / Spec情報の伝播はまだ手作業。

## Decision

Implementation Handoffは以下をdeterministicに生成する。

- readiness再検証
- Source Context Pack / Context ID
- Spec directory
- suggested branch name
- suggested worktree path
- suggested git commands
- Developer start checklist
- PR provenance checklist

スクリプト自身はgit stateを変更しない。

## Why

branch/worktree作成まで自動実行すると、ローカル環境や未commit変更に依存して事故範囲が広がる。初版では「安全な実行計画」を生成するところまでに留める。
