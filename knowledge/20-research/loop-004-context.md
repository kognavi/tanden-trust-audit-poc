---
id: loop-004-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-003-context-to-spec-handoff.md
  - scripts/scaffold-spec-from-context.js
  - AGENTS.md
  - .kiro/agents/architect.md
  - .kiro/agents/developer.md
supports:
  - loop-004-spec-readiness-gate
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 004 Context

## Problem

Loop 003でSpec scaffoldの入口は標準化されたが、placeholderや未解決review itemが残った状態でも人間やAgentがimplementationへ進めてしまう余地がある。

## Decision

Spec Readiness Gateはdeterministic validationとし、Specの品質判断そのものをAIへ委ねない。

Gateは「未完成の明白な兆候」を検出する。

- placeholder token
- Open Questions sectionの未解決item
- unchecked Review Checklist item
- required section欠落
- Source Context Pack不一致
- required file欠落

## Non-goal

要件の妥当性や設計品質そのものを自動採点しない。
