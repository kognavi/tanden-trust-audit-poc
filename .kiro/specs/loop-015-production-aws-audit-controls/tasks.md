# loop-015-production-aws-audit-controls Tasks

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls`

- [x] Re-read Context Pack, root `AGENTS.md`, and `infra/AGENTS.md`.
- [x] Verify current code, tests, module registry, AWS design, threat model, cost guardrails, and existing Terraform modules.
- [x] Review and finalize `requirements.md`.
- [x] Review and finalize `design.md` with control-plane/live-mutation separation.
- [x] Require an independent Security Reviewer.
- [x] Run `npm run spec:ready -- loop-015-production-aws-audit-controls`.
- [x] Generate and review Implementation Handoff.
- [x] Bootstrap Work orchestration with independent Reviewer and Security Reviewer roles.
- [ ] Add the standalone production AWS audit controls Terraform module without environment instantiation.
- [ ] Add CloudTrail record-plane controls and Evidence bucket-scoped S3 data events.
- [ ] Add EventBridge detection rules and SNS notification boundary without subscriptions.
- [ ] Add variable validation, constrained outputs, module documentation, and Human Approval runbook.
- [ ] Add deterministic local regression tests for security, scope, and no-live-mutation guarantees.
- [ ] Run focused tests and `npm run check:structure`.
- [ ] Run Terraform formatting/validation if Terraform CLI is available; record unavailable tooling truthfully.
- [ ] Run Implementation Conformance Gate.
- [ ] Hand implementation to independent Reviewer.
- [ ] Hand implementation to independent Security Reviewer after Reviewer PASS.
- [ ] Record reusable learning in `knowledge/30-learnings/`.
- [ ] Generate Verification Evidence only after both independent reviews PASS.
- [ ] Leave push, PR, merge, deploy, AWS apply, IAM/KMS/retention/subscription changes, and destructive operations to explicit Human Approval.
