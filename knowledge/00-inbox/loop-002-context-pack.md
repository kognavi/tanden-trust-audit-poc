---
id: loop-002-context-pack
type: idea
status: inbox
created: 2026-09-08
updated: 2026-09-08
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 002 - Context Pack 自動生成

## Goal

GitHub repository内のInbox noteを入力として、関連するAGENTS.md、spec、docs、code、tests、knowledgeを探索し、Context Packを自動生成できるようにする。

## Expected Output

`knowledge/20-research/context-packs/` にMarkdown形式のContext Packを生成する。

## Initial Scope

- AGENTS.md
- .kiro/specs/
- docs/
- lib/
- tests/
- knowledge/

## Constraints

- AWS resourceを追加しない
- 新しい外部サービスを使わない
- まずはlocal-first
- Human reviewを残す
- 自動実装までは行わない

## Success Criteria

1つのInbox noteから、関連ファイル一覧と主要制約を含むContext Packを生成できる。
