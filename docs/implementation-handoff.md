# Implementation Handoff

## Purpose

Spec Readiness Gateを通過したfeatureを、実装担当とPRへ同じprovenance付きで渡します。

## Command

```bash
npm run impl:handoff -- <feature-slug>
```

## Preconditions

- `npm run spec:ready -- <feature-slug>` がPASSすること
- requirements/design/tasksがfinalizedされていること

## Output

```text
.kiro/specs/<feature>/implementation-handoff.md
```

Manifestには以下を含みます。

- Source Context Pack
- Context ID
- Spec directory
- Spec Readiness PASS
- suggested branch
- suggested worktree
- suggested git commands
- Developer checklist
- PR provenance

## Git safety

Generatorはgit commandを実行しません。

例として次のようなcommandをmanifestへ提案します。

```bash
git status --short
git fetch --prune
git worktree add ../worktrees/<feature> -b feature/<feature> main
cd ../worktrees/<feature>
npm run spec:ready -- <feature>
```

実行前にHuman/Developerがlocal git stateを確認します。

## PR provenance

RepositoryのPR templateには以下を記録します。

- Source Context Pack
- Context ID
- Spec
- Spec Readiness
- Implementation Handoff
- Branch / Worktree

これにより、PRから設計・文脈の出所まで遡れます。

## Standard flow

```text
Context Pack
  ↓
Spec
  ↓
Spec Readiness PASS
  ↓
Implementation Handoff
  ↓
Human / Developer creates branch or worktree
  ↓
Implementation
  ↓
Tests / Security Review
  ↓
PR with provenance
```
