# Implementation Handoff Design

## Flow

```text
Spec Readiness Gate PASS
  ↓
implementation handoff generator
  ↓
implementation-handoff.md
  ├─ provenance
  ├─ branch suggestion
  ├─ worktree suggestion
  ├─ Developer checklist
  └─ PR provenance
  ↓
Human / Developer executes git commands
  ↓
Implementation
  ↓
PR
```

## Safety boundary

Generatorはfilesystem上にhandoff Markdownを作るだけ。

実行しないもの:

- git branch
- git worktree
- git push
- GitHub PR creation
- AWS API
- deployment

## Provenance chain

```text
Inbox
→ Context Pack
→ Spec
→ Spec Readiness
→ Implementation Handoff
→ Branch / Worktree
→ PR
```

## Overwrite policy

既存 `implementation-handoff.md` がある場合はfailする。
再生成は明示的なreview後に既存fileを削除/更新する別操作とする。
