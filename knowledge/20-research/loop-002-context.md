---
id: loop-002-context
type: research
status: reviewed
created: 2026-09-08
updated: 2026-09-08
source:
  - AGENTS.md
  - docs/module-registry.md
  - docs/loop-engineering.md
  - knowledge/30-learnings/loop-001-knowledge-metadata-validation.md
supports:
  - loop-002-context-pack
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 002 Context

## Existing constraints

- current implementation truthはcode / tests / module registry。
- chat sessionではなくRepository MarkdownとGit historyを継続状態とする。
- Context Packは実装判断を置き換えず、関連文脈を集約する補助資料とする。
- raw prompt、raw response、secret、credential、不要なPIIを保存しない。
- Evidence → Schema → Sign → Store → Ledger のTrust Boundaryを変更しない。
- Local-first / AWS-on-demandを維持する。

## Design direction

初版は外部AI APIやembeddingを使わず、Inbox noteから抽出したtechnical tokenとRepository file content/pathの一致で候補をrankする。

必ず含めるRepository-wide ruleはAGENTS.md。その他は関連度で選ぶ。

## Why deterministic first

Context Pack生成そのものをAI APIへ依存させると、再現性・cost・offline性が下がる。まずdeterministic retrievalを作り、その出力を後段のKiro/Codexが読む二段構成にする。
