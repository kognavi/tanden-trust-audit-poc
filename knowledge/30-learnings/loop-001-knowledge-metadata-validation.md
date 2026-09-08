---
id: loop-001-knowledge-metadata-learning
type: learning
status: reviewed
created: 2026-09-08
updated: 2026-09-08
source:
  - scripts/validate-knowledge-metadata.js
  - tests/knowledge-metadata.test.js
  - package.json
  - PR-164
supports:
  - loop-001-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 001 Learning: Knowledge Metadata Validation

## What worked

最初のLoop Engineering実運用で、Human Inbox由来のアイデアをRepository Inboxへ取り込み、Context、Spec、Implementation、Test、Review、LearningまでGit上に残せた。

knowledge metadata validationは新規npm dependencyを追加せず、Node.js標準機能だけで実装できた。

## Validation outcome

PR #164の確認時点で以下が成功した。

- CI
- Architecture Check (Circular Dependency)
- Semgrep

CodeQL Security ScanはLearning作成時点では実行中であり、merge前のsecurity gateとして確認する。

## Reusable lessons

1. Inboxとreviewed knowledgeは同じ厳しさにしない。
   - Inboxはcapture速度を優先してsource/reviewerを空にできる。
   - reviewed / approvedはsourceとreviewerを要求する。

2. Knowledge Graph relationとsource referenceを分離する。
   - supports / contradicts / supersedes はnote IDだけを参照する。
   - code、docs、test、URL等の根拠はsourceへ置く。

3. Knowledge governanceはdocumentationだけでなくdeterministic checkへ落とす。
   - status typo
   - duplicate ID
   - broken relation
   をCIで検出できる。

4. General YAML parserを自作しない。
   - 現在はRepository templateの限定subsetだけを扱う。
   - frontmatter要件が複雑化した場合は、独自parserを拡張し続けるより標準的なYAML library導入を再評価する。

## Next candidate

次のLoopでは、Inbox noteから関連するspec / ADR / code / tests / knowledgeを収集してContext Packを生成する仕組みを検証する価値が高い。
