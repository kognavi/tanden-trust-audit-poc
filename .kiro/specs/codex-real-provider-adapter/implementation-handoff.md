# Implementation Handoff: codex-real-provider-adapter

## Provenance

- Source Context Pack: `knowledge/20-research/loop-011-context.md`
- Context ID: `loop-011-context`
- Spec directory: `.kiro/specs/codex-real-provider-adapter`
- Spec Readiness: PASS

## Implementation Intent

Connect the provider-neutral Runtime Adapter to a real Codex CLI process for the delegated Reviewer role while preserving Task Graph ordering, separation of duties, structured verdict validation, provider/session provenance, and fail-closed behavior.

## Execution Plan

- Branch: `loop-011-codex-real-provider-adapter`
- Provider: Codex CLI
- Initial real-provider task: Reviewer only
- Sandbox: read-only
- Merge / deploy: Human Approval
