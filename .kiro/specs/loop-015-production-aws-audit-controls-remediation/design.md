# loop-015-production-aws-audit-controls-remediation Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-remediation-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls-remediation`

## Current State

The prior Loop 015 graph is terminal `FAILED` at `c0fcc677bc21cd613c91794c0de9da9fc3a76b45`, retry `2 / 2`. Its third review accepted the Regional detection boundary and minimized alert shape but identified one contradictory table phrase and one correlation-field source error. The module currently labels EventBridge `$.id` as `eventId`; the protected investigation record uses CloudTrail `$.detail.eventID`.

## Proposed Design

Create a separate continuation orchestration namespace, `loop-015-production-aws-audit-controls-remediation`, without touching the prior namespace.

Make exactly two product/test corrections:

1. Change the runbook IAM detective-control cell from `account-wide policy/role change events` to `policy/role change events delivered in home_region`.
2. Change `input_paths.event_id` from `$.id` to `$.detail.eventID`. Extend the existing static contract test to require the new path and reject the old exact mapping.

No other Terraform expression, event pattern, output, resource, module boundary, architecture, or documentation claim is changed.

## Continuation Provenance

- Previous feature: `loop-015-production-aws-audit-controls`
- Previous terminal HEAD/base: `c0fcc677bc21cd613c91794c0de9da9fc3a76b45`
- Previous graph: `.kiro/specs/loop-015-production-aws-audit-controls/agent-task-graph.json`
- Previous graph SHA-256: `d8e1b6e34b5280f23de5cbe7dbb13e7bccc530377e7bd315f96e7f5444c69ebb`
- Previous review evidence: `.kiro/specs/loop-015-production-aws-audit-controls/reviewer-review.md`
- Previous review evidence SHA-256: `30acae6ad81e6a85636115f33a80bbd61dac465502607b1c7e6315d1d9593202`
- New feature: `loop-015-production-aws-audit-controls-remediation`

The new Context Pack, Spec, Handoff, Delegation, Task Graph, Runtime evidence, reviews, and Verification Evidence carry this provenance. The previous files are read-only inputs.

## Affected Components

- `infra/modules/production-aws-audit-controls/main.tf`
- `tests/production-aws-audit-controls.test.js`
- `docs/production-aws-audit-controls.md`
- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-remediation-context.md`
- `.kiro/specs/loop-015-production-aws-audit-controls-remediation/`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged.
- The change affects only AWS control-plane alert metadata and its documentation/test contract.

## Security

- IAM / KMS impact: none; no policy or resource changes.
- Secret / PII impact: none; the existing minimized allowlist remains unchanged except for choosing the correct CloudTrail correlation identifier.
- Auditability impact: improved because alerts correlate directly to protected CloudTrail records and the runbook no longer overstates Regional coverage.
- Security Reviewer: required and independent.

## Cost and Operations

- AWS resource impact: none in repository execution; no plan/apply/deploy.
- Recurring cost impact: none.
- Operational burden: none until a separately approved deployment.

## Alternatives Considered

- Rename `eventId` to `eventBridgeId`: rejected because Reviewer explicitly requires CloudTrail correlation and the alert is intended to start investigation in the CloudTrail record plane.
- Preserve `account-wide` with a footnote: rejected because a table-level false claim is operationally unsafe.
- Reopen/reset the previous graph: prohibited by repository governance and the Human recovery decision.

## Validation Plan

- Focused: `node --test tests/production-aws-audit-controls.test.js`.
- Structure: `npm run check:structure`.
- Readiness: `npm run spec:ready -- loop-015-production-aws-audit-controls-remediation`.
- Conformance: `npm run impl:conform -- loop-015-production-aws-audit-controls-remediation c0fcc677bc21cd613c91794c0de9da9fc3a76b45`.
- Whitespace: `git diff --check`.
- Prior graph/review immutability: compare their SHA-256 digests with the continuation provenance values before and after remediation.
- Independent Reviewer, then independent Security Reviewer.
- Verification Evidence Gate with the fixed continuation base only after both PASS.
- Terraform CLI is unavailable in this Work environment; do not substitute or fake `terraform fmt -check` / `terraform validate`.

## Review Checklist

- [x] Design matches the two Human-approved remediation requirements only.
- [x] Current-state claims were checked against code, tests, old graph, and Reviewer evidence.
- [x] Continuation provenance and prior terminal-state immutability are explicit.
- [x] Trust boundary remains unchanged.
- [x] Security, cost, operations, and Human Approval boundaries are explicit.
