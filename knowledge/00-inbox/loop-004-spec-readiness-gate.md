---
id: loop-004-spec-readiness-gate
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

# Loop 004 - Spec Readiness Gate

## Goal

Context Packから生成・レビューされたSpecがimplementation開始可能な状態かを機械検査し、未確定Specからの実装開始を防ぐ。

## Gate Conditions

- requirements/design/tasksが存在する
- Source Context Packが3ファイルで一致する
- placeholderが残っていない
- Open Questionsが未解決でない
- Review Checklistが完了している
- 必須セクションが存在する

## Constraints

- Specの内容自体をAIが自動承認しない
- 実装やmergeを自動実行しない
- AWS resourceを追加しない
- external AI APIを使わない
- Local-first
