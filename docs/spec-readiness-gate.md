# Spec Readiness Gate

## Purpose

Spec scaffoldがimplementation開始可能な最低限の完成状態かをdeterministicに確認します。

このGateは設計品質の自動採点ではありません。要件の妥当性、設計判断、security/cost判断はKiro/Codex/Human reviewを必要とします。

## Command

```bash
npm run spec:ready -- <feature-slug>
```

## Gate checks

- requirements.md / design.md / tasks.md が存在する
- 3ファイルのSource Context Pack path / Context IDが一致する
- 必須sectionが存在する
- `<...>` placeholderが残っていない
- requirementsのOpen Questionsが解決済み
- designのReview Checklistが完了している

## Open Questions

解決済みを明示する場合は次を使用できます。

```text
## Open Questions

None
```

または:

```text
## Open Questions

- Resolved: none
```

## Important distinction

tasks.mdのimplementation taskが未完了でもReadiness Gateはpass可能です。

Readiness Gateは「実装前の仕様完成度」を確認するため、実装・test・PRなど後続taskの未完了をfail条件にはしません。

## Standard flow

```text
Context Pack
  ↓
Spec Scaffold
  ↓
Architect / Human Review
  ↓
Spec Readiness Gate
  ↓ PASS
Implementation
```

Gateがfailした場合はimplementationへ進まず、Spec / Context loopへ戻ります。
