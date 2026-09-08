---
id: context-pack-loop-002-context-pack
type: context-pack
status: draft
created: 2026-09-08
updated: 2026-09-08
source:
  - knowledge/00-inbox/loop-002-context-pack.md
  - AGENTS.md
  - docs/loop-engineering.md
  - docs/ai-development-os.md
  - docs/module-registry.md
  - knowledge/20-research/loop-002-context.md
  - knowledge/30-learnings/loop-001-knowledge-metadata-validation.md
  - .kiro/specs/context-pack-generator/requirements.md
  - .kiro/specs/context-pack-generator/design.md
  - tests/context-pack.test.js
supports:
  - loop-002-context-pack
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: loop-002-context-pack

## Intent

Source inbox: `knowledge/00-inbox/loop-002-context-pack.md`

Inbox noteを入力として、実装前に読むべきRepository文脈を自動収集するlocal-first Context Pack generatorを追加する。

## Repository Rules

- `AGENTS.md` must be read before implementation.
- code / tests / module registry remain current implementation truth.
- knowledge noteはcurrent implementation truthを上書きしない。

## Related Files

- `docs/loop-engineering.md`
- `docs/ai-development-os.md`
- `docs/module-registry.md`
- `knowledge/20-research/loop-002-context.md`
- `knowledge/30-learnings/loop-001-knowledge-metadata-validation.md`
- `.kiro/specs/context-pack-generator/requirements.md`
- `.kiro/specs/context-pack-generator/design.md`
- `tests/context-pack.test.js`

## Extracted Constraints

- Preserve `Evidence → Schema → Sign → Store → Ledger`.
- Keep Local-first / AWS-on-demand.
- Do not add AWS resources or external AI services for Context Pack generation.
- Do not store raw prompts, raw responses, secrets, credentials, or unnecessary PII.
- Context Pack is supporting context, not a replacement for code/tests/module registry.
- Human or independent Agent review remains required before implementation decisions are treated as approved.

## Review Checklist

- [ ] Related files are actually relevant to the Inbox intent.
- [ ] No security-sensitive context is missing.
- [ ] No stale knowledge is being treated as implementation truth.
- [ ] Scope is narrow enough for the next spec/implementation step.
