# Verification & Evidence Gate

## Purpose

Implementation Conformance後のquality signalsを、一つのmachine-readable Evidence Packへまとめます。

このGateは「AIが完了と言った」ことを証拠にしません。既存のdeterministic checksを実行し、その結果、changed files、provenance、sensitive-path signalを再検証可能なartifactへ固定します。

## Command

```bash
npm run verify:gate -- <feature-slug> [base-ref]
```

default base-refは `main` です。

## What it verifies

1. Implementation Conformance GateがPASSすること
2. `npm run check:structure` がPASSすること
3. sensitive path変更時、`.kiro/specs/<feature>/security-review.md` が存在すること
4. security reviewが `Status: PASS` とnon-empty `Reviewed by:` を持つこと
5. PASS結果を `verification-evidence.json` に記録すること
6. Evidence payloadのSHA-256 digestが一致すること

## Evidence Pack

PASS時に次を生成します。

```text
.kiro/specs/<feature>/verification-evidence.json
```

主な内容:

- Source Context Pack
- Context ID
- Spec directory
- base ref
- changed files
- sensitive files
- Implementation Conformance result
- structure validation result
- security review status
- generated timestamp
- SHA-256 digest

## Sensitive path review

Implementation Conformanceと同じsensitive-path signalを使用します。

- `infra/`
- `.github/workflows/`
- pathに `iam`, `kms`, `terraform`, `policy` を含むfile

対象がある場合:

```markdown
# Security Review

- Status: PASS
- Reviewed by: codex-security
```

のようなreview artifactをSpec directoryへ置きます。

## Integrity limitation

SHA-256 digestはEvidence Pack payloadの改変検知signalです。

digital signatureではないため、誰が生成したかというauthenticityやnon-repudiationは保証しません。必要になれば将来LoopでGit commit signing、CI attestation、Sigstore等へ拡張できます。

## Standard flow

```text
Context Pack
  ↓
Spec
  ↓
Spec Readiness Gate
  ↓
Implementation Handoff
  ↓
Implementation
  ↓
Implementation Conformance Gate
  ↓
Verification & Evidence Gate
  ↓
Independent Review
  ↓
PR / Human Approval / Merge
```

## Non-goals

- semantic correctnessの自動証明
- Human Approvalの代替
- production verificationの代替
- deployment / mergeの自動実行
- AWS API / external AI API利用
