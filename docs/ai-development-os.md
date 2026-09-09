# AI Development OS

## Purpose
このRepositoryのAI Development OSはAIへ全権を渡す仕組みではありません。Human judgment、specification、specialized agents、deterministic validation、independent reviewを組み合わせる開発ガバナンスです。

## Roles
- Human: intent、重大変更承認、merge判断
- Kiro: requirements、design、task decomposition、implementation orchestration
- Codex: implementation、debugging、tests、independent review
- Deterministic tools: tests、dependency-cruiser、Madge、Semgrep、CodeQL、Dependabot
- Knowledge Vault: chat sessionをまたいで継続するproject state

## Lifecycle
1. current code/docs/testsを確認する。
2. requirements/design/tasksをspecへ記録する。
3. 必要な思考・仮説・調査事項を `knowledge/00-inbox/` へ置く。
4. 関連するknowledge、code、tests、ADRを集めてContext Packとして文脈化する。
5. Context Packをhandoff入力として `.kiro/specs/<feature>/` のrequirements/design/tasks scaffoldを生成し、code/tests/module registryと照合して仕様を確定する。
6. `npm run spec:ready -- <feature-slug>` を実行し、placeholder・未解決Open Questions・未完了Review Checklist・Source Context Pack不整合がないことを確認する。
7. branchまたはgit worktree上で最小変更を実装する。
8. testsとsecurity checksを実行する。
9. 実装担当とは別のAgentがdiffを批判的にreviewする。
10. 再利用価値のあるdecision / research / learningをknowledgeへappendする。
11. Pull Requestを作成し、checksとHuman review後にmergeする。

## Persistent state

AIとの会話はephemeralです。長期状態の正本は以下です。

- `AGENTS.md`: Repository-wide rules
- `.kiro/specs/`: requirements / design / tasks
- `knowledge/`: decision / research / learning
- code / tests / module registry: current implementation truth
- Git history: change provenance

詳細は `docs/loop-engineering.md` を参照してください。

## Safety boundary
production deployment、Terraform destroy、IAM/KMS privilege expansion、security-control removal、public exposure expansion、material cost increaseはHuman Approvalを必要とする。

## Cost
AI Development OS v0.2自体は新しいAWS resourceを作成せず、既存のGitHub ActionsとAWS integrationを再利用する。
