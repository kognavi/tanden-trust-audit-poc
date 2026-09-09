---
id: loop-004-spec-readiness-gate-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/check-spec-readiness.js
  - tests/spec-readiness.test.js
  - docs/spec-readiness-gate.md
  - AGENTS.md
  - .kiro/agents/architect.md
  - .kiro/agents/developer.md
  - PR-167
supports:
  - loop-004-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 004 Learning: Spec Readiness Gate

## What changed

Context Pack → Spec Scaffold → Reviewの後に、implementation開始前のdeterministic Spec Readiness Gateを追加した。

`npm run spec:ready -- <feature-slug>` がpassしないSpecからDeveloperが実装を開始しないことをRepository-wide ruleにした。

## Reusable lessons

1. Readinessと品質評価を分ける。
   - Gateは明白な未完成を検出する。
   - 要件妥当性や設計品質はArchitect/Human reviewが判断する。

2. implementation taskの未完了はreadiness failureではない。
   - readinessは「実装を始められる仕様か」を判定するため、tasks.mdの後続taskはopenでよい。

3. provenance consistencyはgate対象にできる。
   - requirements/design/tasksのSource Context PackとContext IDが一致することを機械検証する。

4. scaffold placeholderはCI-friendlyな未完成シグナルになる。
   - `<...>` を残す設計にしたLoop 003が、そのままLoop 004のdeterministic blockerとして機能する。

5. Open Questionsは曖昧に空にするより明示的に解決状態を書く。
   - `None` または `Resolved: none` を標準表現として扱う。

## Residual limitations

- Markdown parserは限定的なATX headingベース。
- 意味的に曖昧な要件や不十分な設計は検出しない。
- false readinessを防ぐ最終責任はArchitect/Human reviewに残る。

## Next candidate

Loop 005では、Readiness Gate通過後にimplementation branch/worktreeを作る「Implementation Handoff」を標準化し、Spec provenanceをPRまで伝播する価値が高い。
