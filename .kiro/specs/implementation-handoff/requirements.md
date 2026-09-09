# Implementation Handoff Requirements

## Purpose

READYなSpecからimplementation開始に必要なprovenanceと実行計画を標準化する。

## Requirements

- Node.js標準機能だけで動作する。
- 入力はfeature slug。
- `validateSpecDirectory()` を再利用し、Spec Readiness Gateがpassしないfeatureを拒否する。
- 出力は `.kiro/specs/<feature>/implementation-handoff.md`。
- existing handoff fileはdefaultで上書きしない。
- handoffには以下を含める。
  - Source Context Pack path
  - Context ID
  - Spec directory
  - Readiness status
  - suggested branch name
  - suggested worktree path
  - suggested git commands
  - Developer checklist
  - PR provenance fields
- branch名は `feature/<feature-slug>` をdefaultとする。
- worktree pathは `../worktrees/<feature-slug>` をdefault suggestionとする。
- スクリプトはgit commandを実行しない。
- スクリプトはnetwork/AWS/external AI APIを使用しない。
- PR templateにContext Pack / Spec / Readiness / Implementation Handoffの欄を追加する。
- Developerはhandoff manifestを読んでからimplementationを開始する。
- Human Approval gateは既存通り維持する。
