# AI Development OS

## Purpose
このRepositoryのAI Development OSはAIへ全権を渡す仕組みではありません。Human judgment、specification、specialized agents、deterministic validation、independent reviewを組み合わせる開発ガバナンスです。

## Roles
- Human: intent、重大変更承認、merge判断
- Kiro: requirements、design、task decomposition、implementation orchestration
- Codex: implementation、debugging、tests、independent review
- Deterministic tools: tests、dependency-cruiser、Madge、Semgrep、CodeQL、Dependabot

## Lifecycle
1. current code/docs/testsを確認する。
2. requirements/design/tasksをspecへ記録する。
3. 最小変更で実装する。
4. testsとsecurity checksを実行する。
5. 実装担当とは別のAgentがdiffを批判的にreviewする。
6. Pull Requestを作成し、checksとHuman review後にmergeする。

## Safety boundary
production deployment、Terraform destroy、IAM/KMS privilege expansion、security-control removal、public exposure expansion、material cost increaseはHuman Approvalを必要とする。

## Cost
AI Development OS v0.1自体は新しいAWS resourceを作成せず、既存のGitHub ActionsとAWS integrationを再利用する。
