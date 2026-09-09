# Agent Runtime Adapter

## Purpose
Loop 010 adds the execution-plane contract beneath the Loop 009 Task Graph.

The Task Graph decides which task is READY. The Runtime Adapter decides how that task is executed and records run evidence.

## Commands

```bash
npm run agent:runtime:init -- <feature-slug>
npm run agent:runtime:run -- <feature-slug> <task-name> [scripted-result]
```

## Default adapters

- `dry-run`: records execution intent only and never advances the Task Graph.
- `scripted`: deterministic local/test adapter returning PASS, FAIL, or TIMEOUT.

No external AI provider, shell-command, merge, deploy, AWS, or network adapter is included in Loop 010.

## Runtime config

```text
.kiro/specs/<feature>/agent-runtime.json
```

It records adapter type, timeout policy and role provenance.

## Run evidence

```text
.kiro/specs/<feature>/agent-runs/<run-id>.json
```

Each run stores:
- feature
- task
- actor
- adapter
- timeoutMs
- result
- mapped Task Graph event
- startedAt / finishedAt

Raw prompts, raw responses, credentials and secrets are not stored.

## Result mapping

```text
PASS    → <role>-pass
FAIL    → <role>-fail
TIMEOUT → <role>-fail
DRY_RUN → no graph transition
```

Verification maps to `verify-pass` / `verify-fail`.

## Fail closed rules

- only READY tasks may run
- runtime/task graph actor provenance must match
- unsupported adapters fail
- invalid scripted results fail
- dry-run cannot be treated as workflow PASS
- terminal Task Graphs cannot be executed

## Verification integration

Verification Evidence requires `agent-runtime.json` and includes adapter configuration plus per-task run summaries.

This connects control-plane state with execution-plane provenance without claiming that runtime metadata proves semantic correctness.

## Next evolution

Future provider adapters can implement Kiro, Codex, Work or another runtime behind the same contract while keeping Task Graph semantics stable.
