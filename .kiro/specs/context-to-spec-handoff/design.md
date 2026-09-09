# Context Pack to Spec Handoff Design

## Flow

```text
Context Pack
  ↓
validate path + metadata
  ↓
validate feature slug
  ↓
create .kiro/specs/<feature>/
  ↓
requirements.md
design.md
tasks.md
  ↓
Kiro Architect review
  ↓
Human / Agent refinement
  ↓
Implementation
```

## Handoff Contract

Generated files must contain:

- Source Context Pack
- Repository truth reminder
- Architecture invariant
- Human/Agent review gate
- test/security/learning follow-up

## Non-goal

LLMにrequirements/design本文を自動決定させない。
初版はscaffold生成のみ。

## Safety

- Repository外path拒否
- unsafe feature slug拒否
- existing spec overwrite拒否
- network accessなし
- AWS APIなし
- external AI APIなし
