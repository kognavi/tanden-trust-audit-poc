# AI Development OS v0.1 Requirements

## Purpose
既存PoCへKiro、Codex、Skills、MCP、GitHub、AWSを安全に組み合わせるAI-native development governanceを追加する。

## Requirements
- 既存の `Evidence → Schema → Sign → Store → Ledger` を変更しない。
- Terraform、GitHub Actions、security toolingを再利用する。
- non-trivial変更は `.kiro/specs/<feature>/` に requirements/design/tasks を持つ。
- root `AGENTS.md` をRepository-wide ruleの正本とする。
- Kiroは仕様・設計・分解・実装オーケストレーションを主担当とする。
- Codexは実装・debug・test・独立reviewを主担当とする。
- Project MCP configへ個人端末の絶対pathを保存しない。
- production apply/destroy、IAM/KMS privilege expansion、security control removal、public exposure expansion、material cost increaseはHuman Approval必須とする。
- AI Development OS導入だけを理由にAWS resourceやproduction dependencyを追加しない。
