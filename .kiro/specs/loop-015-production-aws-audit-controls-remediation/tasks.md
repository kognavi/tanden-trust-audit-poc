# loop-015-production-aws-audit-controls-remediation Tasks

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-remediation-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls-remediation`

- [x] Confirm Human recovery approval and clean worktree at prior terminal HEAD.
- [x] Re-read Context Pack, root `AGENTS.md`, and `infra/AGENTS.md`.
- [x] Verify current runbook, Terraform transformer, regression tests, old Reviewer evidence, and old terminal Task Graph.
- [x] Create a new remediation Context Pack with exact continuation provenance.
- [x] Finalize remediation-only Requirements and Design.
- [x] Run Spec Readiness Gate.
- [x] Generate and review Implementation Handoff with old graph/review SHA-256 provenance.
- [x] Bootstrap a new Work orchestration with independent Reviewer and Security Reviewer.
- [x] Record Builder runtime evidence without advancing the graph through dry-run output alone.
- [x] Correct the runbook `account-wide` phrase to the `home_region` boundary.
- [x] Map alert `eventId` from CloudTrail `$.detail.eventID` and reject EventBridge `$.id` in regression tests.
- [x] Run focused tests, `npm run check:structure`, Spec Readiness, Implementation Conformance, and `git diff --check`.
- [x] Confirm the previous terminal graph and review evidence retain their recorded SHA-256 digests.
- [x] Hand the remediation to an independent Reviewer and record PASS truthfully.
- [x] Hand the remediation to an independent Security Reviewer after Reviewer PASS and record PASS.
- [ ] Generate Verification Evidence only after both reviews PASS.
- [ ] Stop at Human Merge Decision; do not push, create PR, merge, deploy, apply, or mutate AWS resources.
