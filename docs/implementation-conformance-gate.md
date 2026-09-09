# Implementation Conformance Gate

## Purpose

実装後のchanged filesが、review済みSpecの明示的scopeとprovenanceから逸脱していないかをPR前に確認します。

このGateはコードの意味的正しさを証明しません。scope driftとprovenance driftをdeterministicに検出する補助Gateです。

## Command

```bash
npm run impl:conform -- <feature-slug> [base-ref]
```

default base-refは `main` です。

## Preconditions

- Spec Readiness PASS
- `.kiro/specs/<feature>/implementation-handoff.md` が存在する
- design.mdの `Affected Components` に変更予定pathが明示されている

## Affected Components

例:

```markdown
## Affected Components

- `lib/evidence-processing-service.js`
- `tests/evidence-processing-service.test.js`
- `docs/`
```

末尾 `/` はdirectory prefix、file pathはexact matchです。

次はgovernance artifactとしてscope外でも許可されます。

- `.kiro/specs/<feature>/`
- `knowledge/30-learnings/`

## Sensitive path signal

以下の変更はadditional review signalです。

- `infra/`
- `.github/workflows/`
- pathに `iam`, `kms`, `terraform`, `policy` を含むfile

この場合design.mdの以下sectionがnon-emptyであることを要求します。

- Trust Boundary Impact
- Security
- Cost and Operations

## Provenance checks

Spec ReadinessとImplementation Handoffで次が一致する必要があります。

- Source Context Pack
- Context ID
- Spec directory

## Important limitation

GateがPASSしても、要件とコードの意味的一致やsecurity判断の正しさは保証されません。

必ずindependent diff reviewを続けます。

## Standard flow

```text
Spec Readiness
  ↓
Implementation Handoff
  ↓
Implementation
  ↓
Tests / Security Checks
  ↓
Implementation Conformance Gate
  ↓ PASS
Independent Review
  ↓
PR with provenance
```
