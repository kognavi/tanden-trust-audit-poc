# S3 WORM (Object Lock) Verification

このディレクトリは、ADR 0003で検討された「S3 Object Lock (Compliance mode)」の技術検証結果を記録する場所です。

## 検証内容
- **Compliance Modeの実装**: 1日保持のObject Lockを適用し、監査証跡の改ざん防止を検証。
- **Deny Policyの最適化**: バケットレベルとオブジェクトレベルの操作を分離し、最小権限の原則に基づくポリシーを実装。
- **セキュリティ強化**: AWS管理キー(SSE-KMS)による暗号化と、アクセスログの別バケット転送を実装。

## 検証結果 (terraform plan)
- リソース: 13 to add, 0 to change, 0 to destroy（破壊的変更なし）
- 詳細は `plan_output.txt` を参照

## 詳細は `docs/adr/0003-s3-object-lock-consideration.md` を参照してください。
