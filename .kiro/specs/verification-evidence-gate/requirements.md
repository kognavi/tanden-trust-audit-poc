# Verification & Evidence Gate Requirements

## Source Context Pack

- `knowledge/20-research/loop-007-context.md`
- Context ID: `loop-007-context`

## Purpose

Implementation後のquality signalsを第三者が追跡可能なEvidence Packへまとめ、merge前のVerificationを標準化する。

## Current Implementation Truth

- Loop 006でSpec Readiness / Implementation Handoff / changed-file scope / provenanceをImplementation Conformance Gateが検査する。
- `npm run check:structure` がrepository標準のdeterministic validation interfaceである。
- sensitive path変更時のimpact declarationはあるが、独立security review artifactの存在はまだGate化していない。

## Requirements

- Node.js標準機能のみで実装する。
- `npm run verify:gate -- <feature-slug> [base-ref]` を提供する。
- Implementation Conformance Gateを再利用する。
- `npm run check:structure` がPASSしなければGateをfailする。
- testではstructure runnerをinjectでき、subprocessへ依存しない。
- changed files / sensitive files / Source Context Pack / Context ID / Spec directory / base refをEvidence Packへ含める。
- sensitive filesがある場合、`.kiro/specs/<feature>/security-review.md` を要求する。
- security-review.mdは `Status: PASS` とnon-empty `Reviewed by:` を含む。
- pass時、`.kiro/specs/<feature>/verification-evidence.json` を生成する。
- Evidence Pack payloadにSHA-256 digestを付与し、再検証できる。
- fail時はnon-zero exit codeを返し、Evidence PackをPASSとして生成しない。
- production deploy、merge、AWS API、external AI APIを実行しない。

## Invariants

- Evidence → Schema → Sign → Store → Ledger のproduct trust boundaryを変更しない。
- security controlを弱めてGateを通さない。
- digestをdigital signatureやauthenticity proofと表現しない。

## Acceptance Criteria

- conformant implementation + structure PASSでEvidence Packが生成される。
- Implementation Conformance failureでGateがfailする。
- structure validation failureでGateがfailする。
- sensitive file変更でsecurity-review.md欠落時はfailする。
- security-review.mdがPASSならsensitive変更でもGateを継続できる。
- Evidence Pack digestのtamperを検出できる。
- governance wiringがAGENTS / Developer / PR template / AI Development OS / testsに反映される。

## Open Questions

None

## Review Gate

Reviewed for Loop 007 implementation.
