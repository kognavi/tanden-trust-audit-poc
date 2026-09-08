---
id: loop-001-context
type: research
status: reviewed
created: 2026-09-08
updated: 2026-09-08
source:
  - docs/loop-engineering.md
  - knowledge/templates/note.md
  - tests/agent-os-structure.test.js
supports:
  - loop-001-validate-knowledge-metadata
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 001 Context

## Context gathered

既存のLoop Engineering v0.2は、knowledge noteに `status`、`source`、`supports`、`contradicts`、`supersedes`、`reviewed_by` を持たせる方針を定義している。

既存testはtemplateにfieldが存在することだけを確認しており、実noteの値、重複ID、relation参照切れは検証していない。

## Decision

初回Loopでは外部YAML dependencyを追加せず、Repositoryで採用している限定的frontmatter形式だけを解析するvalidatorをNode.js標準機能で実装する。

validation対象は `knowledge/` 配下の実noteとし、READMEおよびtemplatesは除外する。

## Quality gate

- allowed status: inbox / draft / reviewed / approved / superseded
- note IDは空不可かつknowledge内で一意
- relationは存在するnote IDを参照する
- reviewed / approvedではsourceとreviewed_byを必須とする

## Why

Inboxは未整理状態を許容し、review済み知識だけに強い品質要件を課すことで、capture速度とknowledge品質を両立する。
