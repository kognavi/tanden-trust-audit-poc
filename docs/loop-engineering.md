# Loop Engineering v0.2

## Purpose

このRepositoryでは、AIとの会話そのものを長期状態として扱わず、Git管理されたMarkdownを継続状態の正本として扱います。

LLMは一時的な実行主体、Repository内のknowledge vaultは永続状態です。

## Core Loop

```text
Human idea
  ↓
knowledge/00-inbox/
  ↓
context gathering
  ↓
draft
  ↓
independent review
  ↓
append / new note
  ↓
Git diff
  ↓
Human approval
  ↓
merge
  ↓
next loop
```

## Rules

1. 思考・仮説・調査メモはまず `knowledge/00-inbox/` に置く。
2. AIはmain上の既存knowledgeを直接破壊的に書き換えない。
3. non-trivialな変更はbranchまたはgit worktreeで行う。
4. 過去の設計判断は原則として消さず、新しいnoteから関係を記録する。
5. relation metadataは `supports`、`contradicts`、`supersedes` を使用する。
6. AI生成内容はsourceとreview statusを持たせる。
7. security-sensitive / architecture-sensitiveな変更は独立reviewを通す。
8. raw prompt、raw response、secret、credential、不要なPIIをknowledgeへ保存しない。
9. knowledge更新は既存の `Evidence → Schema → Sign → Store → Ledger` trust boundaryを変更しない。
10. AWS利用は既存のLocal-first / AWS-on-demand方針を維持する。

## Note lifecycle

推奨status:

- `inbox`
- `draft`
- `reviewed`
- `approved`
- `superseded`

## Example frontmatter

```yaml
---
id: adr-example
type: decision
status: reviewed
created: 2026-09-08
updated: 2026-09-08
source:
  - docs/architecture.md
supports:
  - evidence-processing-boundary
contradicts: []
supersedes: []
reviewed_by:
  - codex
---
```

## Human approval boundary

以下は従来通りHuman Approval必須です。

- production deployment
- Terraform destroy
- IAM / AWS KMS privilege expansion
- security control removal
- public exposure expansion
- material cost increase
- canonical architecture invariantの変更

## Obsidian

`knowledge/` は通常のMarkdownとして管理し、Obsidian Vaultとして開くことができます。
Obsidian固有設定は個人環境に依存するため、Repositoryの正本にはしません。
