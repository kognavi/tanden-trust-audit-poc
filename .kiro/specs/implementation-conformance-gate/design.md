# Implementation Conformance Gate Design

## Flow

```text
READY Spec + Implementation Handoff
  ↓
changed files
  ↓
Affected Components allowlist
  ↓
scope drift check
  ↓
sensitive-path impact declaration check
  ↓
provenance consistency check
  ↓
CONFORMANT / NOT CONFORMANT
```

## Affected Components syntax

design.mdのAffected Components sectionでは次を許可する。

```text
- lib/evidence-processing-service.js
- tests/evidence-processing-service.test.js
- docs/
```

末尾 `/` はprefix、file pathはexact matchとして扱う。

## Git behavior

CLIのdefaultはread-only diff。

```bash
git diff --name-only --diff-filter=ACMR main...HEAD
```

testではchanged-file arrayを直接渡す。

## Non-goal

- 要件とコードの意味的一致を自動証明しない
- security impactの正しさを自動判定しない
- git stateを変更しない
