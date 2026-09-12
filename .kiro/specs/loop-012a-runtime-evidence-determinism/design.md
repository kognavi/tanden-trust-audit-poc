# loop-012a-runtime-evidence-determinism Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-012a-runtime-evidence-determinism-context.md`
- Context ID: `context-pack-loop-012a-runtime-evidence-determinism`

## Current State

`readRuntimeEvidenceSummary()` reads `agent-runs/*.json`, groups runs by task, and emits the latest run into Verification Evidence. The prior implementation sorted run filenames lexicographically before grouping, so the final selected run could be older than another run whose filename sorts earlier.

## Proposed Design

Keep the existing aggregation flow and replace only the ordering rule.

For each loaded run, sort by:

1. `finishedAt`
2. `startedAt`
3. `runId`

The final element for each task remains the selected latest run. This preserves the current summary contract while making selection deterministic and based on execution chronology rather than filename shape.

## Affected Components

- `scripts/run-verification-evidence-gate.js`
- `tests/verification-evidence-gate.test.js`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged.
- Verification Evidence provenance becomes more reliable because latest-run selection reflects runtime chronology.
- No signing, storage, ledger, provider-execution, or evidence-schema behavior changes.

## Security

- IAM / KMS impact: none.
- Secret / PII impact: none.
- Auditability impact: improved by removing filename-order ambiguity from runtime provenance selection.
- Future malformed/missing timestamp handling should fail closed rather than fall back to filename ordering.

## Cost and Operations

- AWS resource impact: none.
- Recurring cost impact: none.
- Operational burden: negligible.
- Complexity remains local to in-memory sorting of small local run-evidence sets.

## Alternatives Considered

- Keep filename sorting: rejected because filename order is not a trustworthy execution-time signal.
- Encode timestamps into filenames: rejected because it couples provenance correctness to naming convention and would require broader runtime changes.
- Refactor Agent Runtime storage model: rejected as unnecessary scope expansion for this loop.

## Validation Plan

- Existing tests: full `npm test` and `npm run check:structure`.
- New test: create `z-old.json` with an older timestamp and `a-new.json` with a newer timestamp, then assert that `a-new` is selected.
- Verify `latestRunId`, `latestResult`, and provider session provenance.
- Independent reviewer should confirm that the regression test would fail under the old filename-order implementation.

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Scope is limited to deterministic runtime evidence selection.
- [x] No Human Approval is required for new AWS spend or material architecture change because neither is introduced.
