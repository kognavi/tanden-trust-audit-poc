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
- [ ] Bootstrap a new Work orchestration with independent Reviewer and Security Reviewer.
- [ ] Record Builder runtime evidence without advancing the graph through dry-run output alone.
- [ ] Correct the runbook `account-wide` phrase to the `home_region` boundary.
- [ ] Map alert `eventId` from CloudTrail `$.detail.eventID` and reject EventBridge `$.id` in regression tests.
- [ ] Run focused tests, `npm run check:structure`, Spec Readiness, Implementation Conformance, and `git diff --check`.
- [ ] Confirm the previous terminal graph remains unchanged.
- [ ] Hand the remediation to an independent Reviewer and record PASS/FAIL truthfully.
- [ ] Hand the remediation to an independent Security Reviewer only after Reviewer PASS.
- [ ] Generate Verification Evidence only after both reviews PASS.
- [ ] Stop at Human Merge Decision; do not push, create PR, merge, deploy, apply, or mutate AWS resources.
