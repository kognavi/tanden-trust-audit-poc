# loop-014-kms-signing-api-contract-hardening Tasks

## Source Context Pack

- `knowledge/20-research/context-packs/loop-014-kms-signing-api-contract-hardening-context.md`
- Context ID: `context-pack-loop-014-kms-signing-api-contract-hardening`

- [x] Re-read Context Pack and repository `AGENTS.md`.
- [x] Verify current provider code, consumers, tests, ADRs, and module registry.
- [x] Confirm old `kms-blockchain-tx-signing` Plan and stash are reference-only and will not be revived.
- [x] Finalize `requirements.md` and `design.md` with mandatory Security Reviewer.
- [x] Run `npm run spec:ready -- loop-014-kms-signing-api-contract-hardening`.
- [x] Generate and review Implementation Handoff.
- [x] Bootstrap Work orchestration with an independent Security Reviewer identity.
- [x] Add shared signing contract constants and fail-closed validators.
- [x] Add canonical raw-message APIs to Local and KMS providers.
- [x] Preserve and test deprecated `signDigest` / `verifyDigestSignature` aliases.
- [x] Migrate first-party consumers to the canonical API with legacy injected-provider fallback where required.
- [x] Align module registry and signing design documentation.
- [x] Add focused contract, provider, facade, metadata, and parity tests.
- [x] Run focused tests and `npm run check:structure`.
- [x] Run Implementation Conformance Gate.
- [x] Hand implementation to independent Reviewer.
- [x] Hand implementation to independent Security Reviewer after Reviewer PASS.
- [x] Record reusable learning in `knowledge/30-learnings/`.
- [ ] Generate Verification Evidence only after both independent reviews PASS.
- [ ] Leave merge, deploy, AWS apply, IAM, and KMS changes to explicit Human Approval.
