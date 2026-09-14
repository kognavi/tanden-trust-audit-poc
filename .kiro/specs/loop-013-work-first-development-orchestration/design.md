# loop-013-work-first-development-orchestration Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-013-work-first-development-orchestration-context.md`
- Context ID: `context-pack-loop-013-work-first-development-orchestration`

## Current State

AI Development OSは個別controlを持つが、WorkがHandoff後に実行する標準bootstrapは複数commandの手動連結である。既存init functionsは単体として正しい一方、workflow全体ではHandoff未確認、partial initialization、再初期化、role driftを防ぐcomposition boundaryがない。現在状態も複数artifactを個別に読んで判断する必要がある。

## Proposed Design

`scripts/work-development-orchestrator.js` をthin composition layerとして追加する。新しいTask Graphやprovider abstractionは作らず、既存のpure builders / validatorsを再利用する。

### Bootstrap

`bootstrapWorkOrchestration(repositoryRoot, featureSlug, options)` は次を行う。

1. feature slug、Spec Readiness、Implementation Handoff provenanceを検証する。
2. designのAffected Componentsを解析し、sensitive pathならSecurity Reviewerを必須にする。
3. orchestration artifact setが完全に未作成であることをpreflightする。partial stateも拒否する。
4. existing role validator、Task Graph builder、Runtime config builderを使い、全documentをmemory上で生成・cross-checkする。
5. exclusive createで `agent-delegation.json`、`agent-task-graph.json`、`agent-runtime.json` を書く。
6. unexpected write failureでは、このinvocationが作成したfileだけをrollbackする。

CLIは次とする。

`npm run work:bootstrap -- FEATURE_SLUG [security-reviewer-id] [max-retries]`

BuilderとReviewerのdefault IDsはそれぞれ `chatgpt-builder` と `codex-reviewer`。real Codex Reviewer local overrideはReviewer READY後の明示opt-inに残し、bootstrapでは作らない。

### Status

`getWorkOrchestrationStatus(repositoryRoot, featureSlug)` はartifactを書き換えず、以下を返す。

- `READY_TO_BOOTSTRAP`: Spec/Handoff valid、orchestration artifactなし。
- `ACTIVE`: cross-artifact provenance validで、Task Graph上の唯一のREADY taskをphase/nextActionへmapし、既存Runtime Evidence summaryを表示。
- `COMPLETE`: Verification PASS後。nextActionはHuman merge decision。
- `FAILED`: retry exhausted。nextActionはHuman intervention。
- `INCONSISTENT`: missing prerequisite、partial state、feature/role drift、複数または0 READY taskなど。nextActionなし。

CLIは `npm run work:status -- FEATURE_SLUG` とし、人とAgentが同じ意味を読めるJSONをstdoutへ出す。

## Affected Components

- `scripts/work-development-orchestrator.js`
- `tests/work-development-orchestrator.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `docs/ai-development-os.md`
- `docs/work-first-development-orchestration.md`
- `docs/README.md`
- `knowledge/00-inbox/loop-013-work-first-development-orchestration.md`
- `knowledge/20-research/context-packs/loop-013-work-first-development-orchestration-context.md`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged.
- Change is development governance only; production evidence processing is not modified.
- Role provenance and ordered review/verification controls are preserved and made harder to initialize inconsistently.

## Security

- IAM / KMS impact: none.
- Secret / PII impact: none; no prompt/provider payload is persisted.
- Auditability impact: improved through deterministic bootstrap/status and cross-artifact drift detection.
- Existing artifacts are never overwritten by bootstrap; Human must investigate inconsistent state.
- Codex real-provider authority remains Reviewer-only and read-only.

## Cost and Operations

- AWS resource impact: none.
- Recurring cost impact: none.
- Dependency impact: none; Node.js standard library and existing repository modules only.
- Operational burden: two local npm commands and one small documentation surface.

## Alternatives Considered

- Add a Work-specific Runtime Adapter: rejected because Work already operates at the control-plane/workspace layer and a provider adapter would blur orchestration with task execution.
- Create a second Work Task Graph: rejected because it would duplicate Loop 009 state semantics and create competing sources of truth.
- Automatically run Codex Reviewer, verification, git, or merge: rejected because READY state、explicit provider opt-in、independent review、Human Approval boundaries must remain visible.
- Continue with manual command chaining: rejected because it leaves prerequisite and partial-state correctness to chat/session memory.

## Validation Plan

- Unit tests: clean bootstrap, default roles, optional Security Reviewer, custom retry limit, no overwrite, rollback, provenance mismatch, sensitive scope enforcement.
- Status tests: ready-to-bootstrap, each active READY phase, COMPLETE, FAILED, partial state, role drift, invalid READY count.
- Governance tests: package commands and documentation remain wired through `tests/agent-os-structure.test.js`.
- Existing tests: `npm test` and `npm run check:structure`.
- Security checks: verify no provider execution, external process, network, AWS, git mutation, or secret-bearing output is introduced.

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests/module registry.
- [x] Existing Delegation, Task Graph, Runtime, Reviewer, and Verification controls are reused rather than replaced.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Human Approval and Codex read-only/local-opt-in boundaries remain explicit.
- [x] No material architecture/security/cost change requiring pre-implementation Human Approval is introduced.
