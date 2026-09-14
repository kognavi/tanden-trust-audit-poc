---
id: context-pack-loop-013-work-first-development-orchestration
type: context-pack
status: draft
created: 2026-09-13
updated: 2026-09-13
source:
  - knowledge/00-inbox/loop-013-work-first-development-orchestration.md
  - AGENTS.md
  - docs/ai-development-os.md
  - docs/loop-engineering.md
  - docs/implementation-handoff.md
  - docs/multi-agent-delegation.md
  - docs/agent-orchestrator-task-graph.md
  - docs/agent-runtime-adapter.md
  - docs/codex-real-provider-adapter.md
  - docs/module-registry.md
  - scripts/create-implementation-handoff.js
  - scripts/create-agent-delegation.js
  - scripts/agent-task-graph.js
  - scripts/agent-runtime-adapter.js
  - tests/agent-os-structure.test.js
  - tests/multi-agent-delegation.test.js
  - tests/agent-task-graph.test.js
  - tests/agent-runtime-adapter.test.js
  - .kiro/specs/loop-012a-runtime-evidence-determinism/verification-evidence.json
supports:
  - loop-013-work-first-development-orchestration
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: loop-013-work-first-development-orchestration

## Intent

ChatGPT Workをdevelopment control planeとして使い、Implementation Handoff後のworkflow bootstrapと現在状態の確認を、既存のrepository-local governance artifactsを再利用する単一interfaceへまとめる。

Source inbox: `knowledge/00-inbox/loop-013-work-first-development-orchestration.md`

## Current Implementation Truth

- `npm run spec:ready` と `npm run impl:handoff` がimplementation前のprovenance境界を固定する。
- `npm run agent:delegate`、`npm run agent:graph:init`、`npm run agent:runtime:init` は独立commandであり、Human/Workが順番と前提条件を個別に管理している。
- `agent-delegation.json` はBuilder / Reviewer / optional Security Reviewerを保持し、BuilderとReviewerの同一identityを拒否する。
- `agent-task-graph.json` はBuilder → Reviewer → Security Reviewer(optional) → Verificationの順序、retry、terminal stateを決定的に管理する。
- committed `agent-runtime.json` は全taskを `dry-run` baselineとし、real Codex Reviewerはignored local overrideによる明示opt-in、Reviewer-only、read-only sandboxである。
- 各既存init commandは対象artifactが存在する場合の再初期化を一律には拒否しない。Workがcommandを個別実行すると、skip、順序誤り、意図しない再初期化、cross-artifact driftを起こす余地がある。
- Loop 012Aの完了実績では `chatgpt-builder`、`codex-reviewer`、`verification-gate` のrole flowとVerification Evidenceが使われた。

## Problem

AI Development OSの各controlは存在するが、Workがimplementationを開始する入口で、Handoff完了をfail-closedに検証し、delegation / Task Graph / Runtimeを整合した状態で一度だけbootstrapするinterfaceがない。また、Workが次に許可されたactionを知るには複数JSONとMarkdownを個別に解釈する必要がある。

## Decision

Loop 013ではprovider adapterを追加せず、Work-first orchestrationをrepository-local composition layerとして実装する。

- `work:bootstrap`: Spec Readiness PASSとImplementation Handoff provenanceを検証後、既存pure buildersを再利用してdelegation、Task Graph、committed dry-run Runtimeを初期化する。
- `work:status`: readiness / handoff / delegation / graph / runtime / verification artifactsを読み、cross-artifact driftを検出し、現在phaseと次に許可されたactionを決定的に返す。
- default rolesは直前Loopと同じ `chatgpt-builder` と `codex-reviewer` とする。
- Affected Componentsにsensitive pathが含まれる場合、bootstrap時にSecurity Reviewer identityを必須とする。
- 既存orchestration artifactsまたはpartial stateがある場合は上書きせずfail closedとする。
- Work orchestrationはgit操作、provider実行、Task Graph event、tests、verification、merge、deployを自動実行しない。

## Repository Rules

- `AGENTS.md` must be read before implementation.
- code / tests / module registry remain current implementation truth.

## Related Files

- `docs/ai-development-os.md`: canonical lifecycle and Human Approval boundary.
- `scripts/create-implementation-handoff.js`: readiness and provenance handoff contract.
- `scripts/create-agent-delegation.js`: role validation and delegation artifact builder.
- `scripts/agent-task-graph.js`: deterministic workflow state and retry semantics.
- `scripts/agent-runtime-adapter.js`: committed dry-run runtime and local Codex Reviewer opt-in.
- `tests/agent-os-structure.test.js`: governance wiring regression tests.
- `.kiro/specs/loop-012a-runtime-evidence-determinism/verification-evidence.json`: latest completed role/orchestration evidence.

## Extracted Constraints

- Preserve Evidence -> Schema -> Sign -> Store -> Ledger.
- Keep Local-first / AWS-on-demand.
- Do not add AWS resources or external AI services for Context Pack generation.
- Do not store raw prompts, raw responses, secrets, credentials, or unnecessary PII.
- Context Pack is supporting context, not a replacement for code/tests/module registry.
- Human or independent Agent review remains required before implementation decisions are treated as approved.
- Work-first does not grant Work autonomous merge, deploy, IAM/KMS changes, destructive operations, or security-control removal.
- Codex real-provider execution remains Reviewer-only, local opt-in, and read-only.
- Bootstrap must never silently overwrite existing delegation, graph, runtime, review, or verification state.

## Validation

- happy-path bootstrap creates mutually consistent delegation, Task Graph, and committed dry-run Runtime.
- bootstrap fails before writes when Spec is not ready, Handoff is missing/inconsistent, role separation is invalid, sensitive scope lacks Security Reviewer, or any orchestration artifact already exists.
- status reports pre-bootstrap, Builder READY, Reviewer READY, Verification READY, COMPLETE, FAILED, and inconsistent/partial states deterministically.
- structure tests keep the new commands and documentation wired into AI Development OS.
- `npm test` and `npm run check:structure` remain green.

## Review Checklist

- [x] Related files are actually relevant to the Inbox intent.
- [x] No security-sensitive context is missing.
- [x] No stale knowledge is being treated as implementation truth.
- [x] Scope is narrow enough for the next spec/implementation step.
