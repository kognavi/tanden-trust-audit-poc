---
id: loop-011-context
type: research
status: reviewed
created: 2026-09-10
updated: 2026-09-10
source:
  - knowledge/30-learnings/loop-010-agent-runtime-adapter.md
  - scripts/agent-runtime-adapter.js
  - https://github.com/openai/codex/blob/main/codex-rs/exec/src/cli.rs
supports:
  - loop-011-codex-real-provider-adapter
contradicts: []
supersedes: []
reviewed_by:
  - chatgpt
---

# Loop 011 Context

OpenAI Codex CLIのcurrent implementationは `codex exec` にnon-interactive execution、JSONL event output、output schema、last-message fileを提供する。

Loop 011ではgeneric execution engineではなくReviewer専用adapterから始める。Provider process exitとsemantic review verdictを分離する。

## Provider contract

```text
Reviewer READY
  ↓
codex exec --json --sandbox read-only
  ↓
structured final response
  ↓
PASS / FAIL
  ↓
reviewer-pass / reviewer-fail
```

Provider起動失敗・CLI不在・invalid outputは `PROVIDER_ERROR` としてrun evidenceへ記録し、Task Graphは進めない。
