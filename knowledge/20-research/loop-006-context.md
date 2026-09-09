---
id: loop-006-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-005-implementation-handoff.md
  - scripts/check-spec-readiness.js
  - scripts/create-implementation-handoff.js
  - docs/implementation-handoff.md
  - .github/pull_request_template.md
supports:
  - loop-006-implementation-conformance
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 006 Context

## Current gap

Loop 005でSpec provenanceをimplementationとPRまで渡せるようになったが、実際のdiffがSpecのAffected Componentsを超えていないかは人間reviewだけに依存している。

## Decision

初版Conformance Gateはsemantic equivalenceを判定しない。
明示的なscope driftとprovenance driftをdeterministicに検出する。

## Scope source

design.mdの `## Affected Components` に書かれたpath/prefixを許可範囲として扱う。

テストやdocsも変更するなら、Spec review時にAffected Componentsへ明示する。

## Sensitive paths

以下は追加review signalとして扱う。

- `infra/`
- `.github/workflows/`
- pathに `iam`, `kms`, `terraform`, `policy` を含むもの

これらを変更する場合、designのSecurity / Cost and Operations / Trust Boundary Impact sectionがnon-emptyであることを要求する。
