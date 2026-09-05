# AI Development OS v0.1 Design

## Flow
Human → Kiro orchestration → implementation → deterministic tests/Semgrep/CodeQL → Codex independent review → Pull Request → protected main

## Layout
- `AGENTS.md`: shared constitution
- `.kiro/specs/`: feature specs
- `.kiro/skills/`: Kiro Skills
- `.kiro/agents/`: Kiro specialized Agents
- `.agents/skills/`: Codex Skills
- `.codex/config.toml`: Codex safe defaults
- `infra/AGENTS.md`: Terraform/AWS guardrails
- `tests/agent-os-structure.test.js`: deterministic governance tests

## Decisions
- Existing Terraform remains the IaC source of truth. CDK is not introduced.
- Existing CI is reused. New workflow is not required because current CI runs `npm test`.
- Project MCP remains minimal. Semgrep is kept and made portable.
- No AWS resource or dependency is added by this change.
