# Loop Engineering v0.2 Design

## Flow

```text
Human
  ↓
knowledge/00-inbox
  ↓
Context Agent
  ↓
Draft
  ↓
Independent Critic
  ↓
Git diff
  ↓
Human approval
  ↓
merge
  ↓
Knowledge Graph relations
```

## State ownership

- Chat session: ephemeral execution context
- `knowledge/`: durable project knowledge
- Git history: change history
- AGENTS.md: repository-wide operating rules
- `.kiro/specs/`: feature specification
- code/tests: current implementation truth

## Relation vocabulary

- `supports`: note A strengthens or provides evidence for note B
- `contradicts`: note A conflicts with note B
- `supersedes`: note A replaces an older decision or conclusion

## Safety

The loop never bypasses the existing EvidenceProcessingService trust boundary and does not introduce AWS runtime dependencies.
