---
id: loop-003-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-002-context-pack-generation.md
  - docs/ai-development-os.md
  - AGENTS.md
  - .kiro/agents/architect.md
  - .kiro/agents/developer.md
supports:
  - loop-003-context-to-spec-handoff
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 003 Context

## Existing flow

Human Inbox → Repository Inbox → Context Pack → manual Spec creation

## Problem

Context Packまでは標準化されたが、その後にrequirements/design/tasksへ落とす入口と最低限の構造がまだ人依存。

## Decision

Context PackからSpec内容を自動決定するのではなく、以下をdeterministicに行う。

- Context Packの存在とmetadataを検証
- feature slugを安全に検証
- 3つのSpec scaffoldを生成
- source Context Packを全Specへ明示
- Repository invariant / review gate / test gateを標準項目として含める

Kiro/Codexは生成されたscaffoldを埋める前にContext Packと関連code/tests/module registryを再確認する。

## Why

Spec skeletonの標準化は再現性を上げる一方、設計判断まで自動生成すると誤ったcontextを固定化する危険がある。初版ではhandoff contractだけを自動化する。
