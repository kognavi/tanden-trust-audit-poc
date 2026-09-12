# Codex Real Provider Adapter Design

## Source Context Pack
- `knowledge/20-research/loop-011-context.md`
- Context ID: `loop-011-context`

## Current State

Loop 010では `agent-runtime.json` がcommitted runtime baselineで、全taskがdefault dry-runとなる。Runtime run evidenceとTask Graphは接続済みだが、real provider executionはない。

## Proposed Design

```text
committed agent-runtime.json
  reviewer = dry-run
        +
ignored agent-runtime.local.json
  reviewer = codex-exec-review
        ↓
effective runtime config
        ↓
Reviewer READY validation
        ↓
spawnSync(codex, args, shell=false)
        ↓
forced --sandbox read-only
        ↓
JSONL stdout → thread/session provenance
last-message JSON → verdict
        ↓
reviewer-review.md + run evidence
        ↓
PASS / FAIL / TIMEOUT → Task Graph
PROVIDER_ERROR → no transition
```

`agent-runtime.local.json` はlocal machine上だけのexplicit opt-inで、gitへcommitしない。コードはreal provider実行時にsandboxをread-onlyへ固定し、override値で緩和できない。

## Affected Components
- `scripts/agent-runtime-adapter.js`
- `scripts/check-implementation-conformance.js`
- `tests/implementation-conformance.test.js`
- `scripts/run-verification-evidence-gate.js`
- `schemas/codex-review-result.schema.json`
- `tests/agent-runtime-adapter.test.js`
- `tests/verification-evidence-gate.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.gitignore`
- `.kiro/agents/reviewer.md`
- `.github/pull_request_template.md`
- `docs/agent-runtime-adapter.md`
- `docs/verification-evidence-gate.md`
- `docs/codex-real-provider-adapter.md`
- `docs/ai-development-os.md`
- `knowledge/00-inbox/loop-011-codex-real-provider-adapter.md`
- `knowledge/20-research/loop-011-context.md`

## Trust Boundary Impact

Product trust flow `Evidence → Schema → Sign → Store → Ledger` は変更しない。今回の変更はAI Development OSのexecution boundaryに限定される。Real Provider設定はlocal boundary、provider verdictはreview evidence boundaryとして扱う。

## Security

- shell=false
- Reviewer-only
- read-only Codex sandboxをコード側で強制
- committed runtime configはreal providerを有効化しない
- local override fileはgitignore対象
- local overrideはReviewerのCodex opt-in専用で、他task adapter overrideを拒否
- provider executableはRuntime側で `codex` に固定し、local設定から変更不可
- prompt generated from repository paths, not user-controlled shell fragments
- raw output excluded from persistent evidence
- Runtime revalidates schema-relevant length/additionalProperties constraints
- PASS with HIGH/CRITICAL findings is rejected as contradictory invalid output
- provider auth remains Codex CLI responsibility
- provider error does not masquerade as semantic FAIL/PASS

## Cost and Operations

Real Codex execution may consume the user's Codex/ChatGPT/API allowance depending on local authentication/configuration. GitHub CIはreal Codexを呼ばない。通常のclone/pullだけではreal providerは有効にならない。

## Alternatives Considered

- committed `agent-runtime.json` でreal providerを有効化: clone直後から実Providerが起動可能になるため却下。
- environment variableだけでopt-in:設定の可読性とtask別adapter contractが弱くなるため、ignored local JSONを採用。
- configurable sandbox:安全境界がconfig改変で緩和されるため却下。
- Codex Builderから開始:書き込み副作用が大きいためReviewer-firstを採用。
- local `main` をdefault baseRefにする: fetch後にstaleになり得るため却下し、`origin/main` をdefaultにする。
- ReviewerがVerification Evidenceを要求する: Verificationはreviewer-pass後にREADYとなるため循環依存になるので却下。

## Validation Plan

- Spec Readiness Gateを実行してPASSを確認
- Implementation Conformance Gateを実行
- unit tests with injected process runner
- committed baselineがdry-runであることをtest
- local overrideなしではreal providerが選択されないことをtest
- sandbox改変を拒否/強制するtest
- JSONL provenance parser tests
- structured verdict parser tests
- timeout/provider error tests
- governance tests
- GitHub CI / Semgrep / CodeQL / Architecture Check

## Review Checklist
- [x] Requirements aligned
- [x] Provider/process vs semantic verdict separated
- [x] Local opt-in boundary explicit
- [x] Read-only sandbox enforced in code
- [x] Security boundary explicit
- [x] Cost boundary explicit
- [x] Human Approval preserved
