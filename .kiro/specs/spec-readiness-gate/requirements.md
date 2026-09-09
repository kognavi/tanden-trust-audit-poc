# Spec Readiness Gate Requirements

## Purpose

implementation開始前にSpecが最低限の完成状態かを機械検証する。

## Requirements

- Node.js標準機能だけで動作する。
- 入力はfeature slug。
- 対象は `.kiro/specs/<feature>/requirements.md`、`design.md`、`tasks.md`。
- feature slugは既存handoffと同じ安全なslug制約を使う。
- 3ファイル欠落時はfailする。
- 3ファイルのSource Context Pack pathとContext IDが一致しなければfailする。
- angle-bracket placeholder `<...>` が残っていればfailする。
- `Open Questions` sectionに未解決のnon-empty bulletが残っていればfailする。
- `Review Checklist` sectionにunchecked checkboxがあればfailする。
- requirementsの必須section:
  - Source Context Pack
  - Purpose
  - Current Implementation Truth
  - Requirements
  - Invariants
  - Acceptance Criteria
  - Open Questions
  - Review Gate
- designの必須section:
  - Source Context Pack
  - Current State
  - Proposed Design
  - Affected Components
  - Trust Boundary Impact
  - Security
  - Cost and Operations
  - Alternatives Considered
  - Validation Plan
  - Review Checklist
- tasksの必須section:
  - Source Context Pack
- pass時はexit 0、fail時はnon-zero。
- `npm run spec:ready -- <feature-slug>` として利用できる。
- Developerはimplementation前にReadiness Gate通過を要求される。
