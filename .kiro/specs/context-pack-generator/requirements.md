# Context Pack Generator Requirements

## Purpose

knowledge/00-inboxのnoteを入口として、実装前に読むべきRepository文脈をMarkdown Context Packへ集約する。

## Requirements

- Node.js標準機能だけで動作する。
- network access、AWS API、external AI APIを使用しない。
- 入力はRepository内のMarkdown Inbox noteとする。
- path traversalでRepository外の入力を読まない。
- scopeは以下を基本とする。
  - AGENTS.md
  - .kiro/specs/
  - docs/
  - lib/
  - tests/
  - knowledge/
- .git、node_modules、generated artifacts、private key相当を探索対象にしない。
- input note自身を候補検索対象から除外する。
- AGENTS.mdは常にContext Packへ含める。
- その他はinput noteとのkeyword overlapでrankし、上位候補を出力する。
- outputはknowledge/20-research/context-packs/配下のMarkdownとする。
- output noteはknowledge metadata validatorを通るfrontmatterを持つ。
- Context Packはdraft statusとし、Human/Agent review前にapproved扱いしない。
- 自動実装や自動mergeは行わない。
- Evidence Trust Boundary、AWS resource、IAM、KMSを変更しない。
