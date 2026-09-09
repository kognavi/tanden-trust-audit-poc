# Context Pack to Spec Handoff Requirements

## Purpose

Context Packをfeature specification作成の正式なhandoff入力として扱い、毎回同じ構造でrequirements/design/tasksへ移行できるようにする。

## Requirements

- Node.js標準機能だけで動作する。
- 入力はRepository内のContext Pack Markdownとfeature slug。
- Context Packは `type: context-pack` でなければ拒否する。
- Context PackはRepository root外から読まない。
- feature slugは `[a-z0-9][a-z0-9-]*` のみ許可する。
- 出力先は `.kiro/specs/<feature>/` に固定する。
- 既存Spec directoryをdefaultでは上書きしない。
- requirements.md / design.md / tasks.mdを生成する。
- 3ファイルすべてにsource Context Pack pathを明示する。
- requirementsには目的、context source、invariants、acceptance criteria、open questionsを含める。
- designにはcontext source、current state確認、proposed design、security/cost、alternatives、review checklistを含める。
- tasksにはcontext確認、requirements/design review、implementation、tests、security review、learning captureを含める。
- generated specは自動承認扱いにしない。
- code / tests / module registryがcurrent implementation truthであることを明示する。
- Evidence → Schema → Sign → Store → Ledgerを変更しない。
- AWS resource、IAM、KMS、production operationを追加・実行しない。
