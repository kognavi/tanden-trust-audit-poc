# Context Pack to Spec Handoff

## Standard Flow

```text
Human / Repository Inbox
  ↓
Context Pack
  ↓
Spec scaffold
  ↓
Kiro Architect review
  ↓
requirements/design/tasks finalized
  ↓
Implementation
```

## Commands

Generate Context Pack:

```bash
npm run context:generate -- knowledge/00-inbox/<note>.md
```

Create the Spec scaffold:

```bash
npm run spec:scaffold -- knowledge/20-research/context-packs/<context>.md <feature-slug>
```

## Handoff Contract

Before implementation, a non-trivial new feature should have:

- a source Context Pack
- `.kiro/specs/<feature>/requirements.md`
- `.kiro/specs/<feature>/design.md`
- `.kiro/specs/<feature>/tasks.md`

All three Spec files must name the Source Context Pack.

The generated scaffold is not an approved specification. Kiro/Codex must replace placeholders after checking current code, tests, `docs/module-registry.md`, and relevant security/cost constraints.

## Truth Hierarchy

```text
code / tests / module registry
        ↓
reviewed Spec
        ↓
Context Pack
        ↓
Inbox / draft knowledge
```

Context Pack is a retrieval and briefing artifact. It does not override current implementation truth.

## Human Approval

Production deployment, Terraform destroy, IAM/KMS privilege expansion, security-control removal, public exposure expansion, material recurring cost, or canonical trust-boundary changes remain Human Approval gates.
