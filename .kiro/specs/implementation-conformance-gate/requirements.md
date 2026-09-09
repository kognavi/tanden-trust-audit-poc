# Implementation Conformance Gate Requirements

## Purpose

実装差分がreview済みSpecの明示的scopeとprovenanceに適合しているかをPR前に検証する。

## Requirements

- Node.js標準機能だけで動作する。
- 入力はfeature slugとchanged-file list。
- changed-file listを明示入力できるようにし、test/CIでgit環境に依存しない。
- CLIではchanged-file list未指定時、read-onlyの `git diff --name-only --diff-filter=ACMR <base>...HEAD` を使用できる。
- Spec Readiness Gateを再利用し、readyでないfeatureを拒否する。
- `.kiro/specs/<feature>/implementation-handoff.md` が存在しなければfailする。
- design.mdのAffected Componentsからallowed path/prefixを抽出する。
- path-like allowed entryが0件ならfailする。
- changed fileがallowed path/prefix外ならfailする。
- 以下のgovernance-only fileはfeature scope外でも許可可能とする:
  - feature自身の `.kiro/specs/<feature>/`
  - `knowledge/30-learnings/`
- Source Context Pack / Context IDがSpec ReadinessとImplementation Handoffで一致しなければfailする。
- sensitive path変更時、designのTrust Boundary Impact / Security / Cost and Operations sectionがnon-emptyであることを要求する。
- pass時はexit 0、fail時はnon-zero。
- `npm run impl:conform -- <feature-slug> [base-ref]` として利用できる。
- Gateはcode semanticsの完全一致を保証しない。
