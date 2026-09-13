# Work-first Development Orchestration

## Purpose

Loop 013 makes ChatGPT Work the development control plane without turning it into an autonomous merge or deployment authority. It composes the existing Spec Readiness, Implementation Handoff, Multi-Agent Delegation, Task Graph, Runtime Adapter, Reviewer, and Verification Evidence controls.

It does not introduce a Work provider adapter or a second Task Graph.

## Bootstrap

After `Context Pack → Spec → Spec Readiness PASS → Implementation Handoff`:

```bash
npm run work:bootstrap -- FEATURE_SLUG [security-reviewer-id] [max-retries]
```

The command:

1. revalidates Spec Readiness and Handoff provenance;
2. requires a Security Reviewer when Spec Affected Components contain sensitive paths;
3. refuses existing or partial orchestration state;
4. creates consistent `agent-delegation.json`, `agent-task-graph.json`, and committed `agent-runtime.json`;
5. starts with Builder `READY` and all committed adapters `dry-run`.

Default role provenance:

- Builder: `chatgpt-builder`
- Reviewer: `codex-reviewer`
- Security Reviewer: optional for non-sensitive scope, required for sensitive scope

The command does not create a branch/worktree, invoke a provider, apply Task Graph events, run tests, verify, merge, or deploy.

## Status

```bash
npm run work:status -- FEATURE_SLUG
```

The command reads durable repository artifacts and returns JSON with:

- overall status;
- current phase;
- the one READY task, when active;
- the next permitted action and applicable repository commands;
- role and retry provenance;
- consistency errors, if any.

Possible status values:

- `READY_TO_BOOTSTRAP`
- `ACTIVE`
- `COMPLETE`
- `FAILED`
- `INCONSISTENT`

`INCONSISTENT` is fail-closed. Work must not guess or advance the graph until a Human or assigned developer resolves the reported artifact drift.

## Existing boundaries retained

- `Evidence → Schema → Sign → Store → Ledger` is unchanged.
- Builder cannot approve its own work as Reviewer.
- Codex real provider remains Reviewer-only, local opt-in, and read-only.
- committed Runtime remains `dry-run`.
- provider execution success is distinct from semantic review PASS.
- Task Graph order and retry routing remain canonical.
- Verification Evidence and Human merge decision remain downstream controls.
- production deployment, destructive operations, IAM/KMS privilege expansion, security-control removal, public exposure expansion, and material cost increase require Human Approval.
