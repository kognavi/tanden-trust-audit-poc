---
id: loop-001-validate-knowledge-metadata
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

# Validate Knowledge Metadata

## Context

AI Development OS v0.2 の最初の実運用として、Repository knowledge loopを1周させる。

## Observation

knowledge noteのfrontmatterは現在templateとstructure testで存在だけを確認しているが、実noteのmetadata品質やrelation参照までは検証していない。

## Goal

Inbox → Context → Spec → Implementation → Test → Review → Learning の一連のLoopを実際に通しながら、knowledge metadataのdeterministic validationを追加する。

## Candidate rules

- statusの許容値を固定する。
- supports / contradicts / supersedes の参照切れを検出する。
- reviewed / approved noteではsourceを必須にする。
- reviewed / approved noteではreviewed_byを必須にする。
- inbox / draftでは未確定情報を許容し、過剰に厳しくしない。

## Open questions

- relation targetはnote IDだけに限定するか。
- READMEやtemplateはvalidation対象から除外するか。
