# Codex Real Provider Adapter Design

## Source Context Pack
- `knowledge/20-research/loop-011-context.md`
- Context ID: `loop-011-context`

## Flow

```text
agent-runtime.json
 reviewer.type = codex-exec-review
        ↓
Reviewer READY validation
        ↓
spawnSync(codex, args, shell=false)
        ↓
JSONL stdout → thread/session provenance
last-message JSON → verdict
        ↓
reviewer-review.md + run evidence (no raw response)
        ↓
PASS / FAIL / TIMEOUT → Task Graph
PROVIDER_ERROR → no transition
```

## Affected Components
- `scripts/agent-runtime-adapter.js`
- `schemas/codex-review-result.schema.json`
- `tests/agent-runtime-adapter.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.kiro/agents/reviewer.md`
- `.github/pull_request_template.md`
- `docs/agent-runtime-adapter.md`
- `docs/codex-real-provider-adapter.md`
- `docs/ai-development-os.md`
- `knowledge/00-inbox/loop-011-codex-real-provider-adapter.md`
- `knowledge/20-research/loop-011-context.md`

## Security
- shell=false
- Reviewer-only
- read-only Codex sandbox
- prompt generated from repository paths, not user-controlled shell fragments
- raw output excluded from persistent evidence
- provider auth remains Codex CLI responsibility
- provider error does not masquerade as semantic FAIL/PASS

## Cost
Real Codex execution may consume the user's Codex/ChatGPT/API allowance depending on local authentication/configuration. Loop 011 never runs real Codex in CI by default.

## Validation
- unit tests with injected process runner
- JSONL provenance parser tests
- structured verdict parser tests
- timeout/provider error tests
- governance tests
- GitHub CI

## Review Checklist
- [x] Requirements aligned
- [x] Provider/process vs semantic verdict separated
- [x] Security boundary explicit
- [x] Cost boundary explicit
- [x] Human Approval preserved
