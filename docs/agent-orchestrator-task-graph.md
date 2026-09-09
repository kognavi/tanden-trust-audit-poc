# Agent Orchestrator / Task Graph

## Purpose

Loop 009 adds a deterministic control plane for the roles introduced in Loop 008.

It does not spawn agents. It controls which role may act next, how failures route back to Builder, and when the workflow becomes COMPLETE or FAILED.

## Commands

Initialize:

```bash
npm run agent:graph:init -- <feature-slug> [max-retries]
```

Apply an event:

```bash
npm run agent:graph:event -- <feature-slug> <event>
```

Supported events:

- `builder-pass`
- `builder-fail`
- `reviewer-pass`
- `reviewer-fail`
- `security-pass`
- `security-fail`
- `verify-pass`
- `verify-fail`

## State file

```text
.kiro/specs/<feature>/agent-task-graph.json
```

The graph records:

- feature
- delegated role identities
- overall status
- maxRetries
- retryCount
- per-task status
- transition history
- timestamps

## Task states

Typical states are:

- `READY`
- `BLOCKED`
- `PASS`
- `FAIL`
- `SKIPPED`

Overall graph status:

- `ACTIVE`
- `COMPLETE`
- `FAILED`

## Flow

```text
Builder READY
   ↓ builder-pass
Reviewer READY
   ├─ reviewer-fail → Builder READY (retry)
   ↓ reviewer-pass
Security Reviewer READY (if delegated)
   ├─ security-fail → Builder READY (retry)
   ↓ security-pass
Verification READY
   ├─ verify-fail → Builder READY (retry)
   ↓ verify-pass
COMPLETE
```

If no Security Reviewer is delegated, Reviewer PASS routes directly to Verification READY.

## Retry behavior

`retryCount` counts retries already granted.

If a failure occurs while `retryCount < maxRetries`, the graph:

1. increments retryCount
2. returns Builder to READY
3. blocks downstream tasks again
4. records the routing event in history

If another failure occurs when no retry remains, the graph becomes `FAILED`.

## Fail-closed behavior

The orchestrator rejects:

- Reviewer events before Reviewer is READY
- Security events without delegated Security Reviewer
- Verification events before Verification is READY
- unknown events
- transitions after COMPLETE or FAILED
- init without valid delegation

## Important limitation

This is a workflow state machine, not an execution engine.

It does not:

- invoke Kiro/Codex/other AI providers
- manage provider sessions
- run jobs concurrently
- perform timeout scheduling
- merge or deploy
- cryptographically authenticate agent identities

Those capabilities can be layered on later without changing the state semantics.

## Human boundary

FAILED means automation stops and control returns to Human judgment.

COMPLETE means the graph has completed its modeled workflow. Merge/deploy still remains subject to repository checks and Human Approval.
