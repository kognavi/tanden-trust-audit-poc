# Implementation Plan: AWS KMS ブロックチェーントランザクション署名基盤

## Overview

既存の `lib/signature.js` ファサードおよびプロバイダーパターンを維持しながら、AWS KMS（ECC_SECG_P256K1）を用いたブロックチェーン署名基盤を追加する。
実装順序は、スキーマ定義 → KMSプロバイダーコア → QLDBロガー → ファサード統合 → CLIスクリプト → テスト → ドキュメントとする。
全工程で既存テストへの影響を出さないよう後方互換性を厳守する。

## Tasks

- [ ] 1. 署名イベントスキーマの定義
  - [x] 1.1 `schemas/signing-event.schema.json` を作成する
    - `eventId`（UUID形式）・`eventType`（`"SIGN"` or `"VERIFY"` 列挙型）・`evidenceId`・`digestHex`（64文字16進数 pattern制約）・`kmsKeyId`・`signingAlgorithm`・`signedAt`（ISO 8601 date-time format）を必須フィールドとして定義
    - `signerRoleArn`・`status`・`valid` フィールドをオプションとして定義
    - `$schema`・`title`・`description` を含め、AJVで検証可能な JSON Schema Draft-07 形式で記述
    - _要件: 4.1, 4.2_

- [ ] 2. AWS KMS プロバイダーのコア実装
  - [ ] 2.1 `lib/aws-kms-provider.js` を作成する — クラス骨格とコンストラクター
    - `AwsKmsProvider` クラスを定義し、コンストラクター引数で KMS クライアント（`@aws-sdk/client-kms`）を注入できる設計にする
    - コンストラクターで `KMS_KEY_ID` 環境変数が未設定の場合 `Error: KMS_KEY_ID environment variable is required` をスローする
    - `LocalEcdsaProvider` と同一の署名インターフェース（`signEvidence`・`verifyEvidenceSignature`・`signDigest`・`verifyDigestSignature`）と `getPublicKey` メソッドのスタブを宣言する
    - 秘密鍵マテリアルをプロパティに保持しないことを確認する
    - _要件: 1.1, 1.6, 1.8, 9.1_

  - [ ] 2.2 `signDigest` および `verifyDigestSignature` を実装する
    - `signDigest(digest)`: `KmsClient.send(new SignCommand(...))` を `ECDSA_SHA_256` アルゴリズムで呼び出し、DER署名を受け取る
    - `verifyDigestSignature(digest, signature)`: `KmsClient.send(new VerifyCommand(...))` を呼び出し、検証結果 boolean を返す
    - KMS API 失敗時は元のAWSエラーをラップし、KMSオペレーション名を含む `Error` をスローする
    - `getPublicKey()`: `GetPublicKeyCommand` を呼び出し、SPKI DER形式の公開鍵バイト列を返す
    - _要件: 1.2, 1.4, 1.5, 1.7_

  - [ ] 2.3 DER → Raw 署名デコード処理を実装する
    - KMS が返す DER エンコード署名を、r値・s値各32バイト（合計64バイト）の IEEE P1363 形式 `Raw_Signature` にデコードする関数 `decodeDerSignatureToRaw` を `lib/aws-kms-provider.js` 内部に実装する
    - DER シーケンス構造（タグ `0x30` → 長さ → r INTEGER → s INTEGER）をパースし、各値を 32 バイトにゼロ埋め／前ゼロ除去して正規化する
    - `signDigest` の戻り値にこの関数を適用し `Raw_Signature` を返す
    - _要件: 1.3, 10.3_

  - [ ]* 2.4 DER ラウンドトリップのプロパティテストを書く（tasks.md 作成後に実装）
    - **プロパティ1: DERラウンドトリップ特性** — 任意の有効な64バイト `Raw_Signature` をDERエンコードし再度デコードした結果が元の値と等しい
    - **プロパティ2: Base64ラウンドトリップ特性** — 任意の64バイト `Raw_Signature` をBase64エンコードし再度デコードした結果が元の値と等しい
    - **検証対象: 要件 10.2, 10.4**
    - `tests/aws-kms-provider.test.js` 内にプロパティテストとして追記する

  - [ ] 2.5 `signEvidence` および `verifyEvidenceSignature` を実装する
    - `signEvidence(evidence)`: `lib/signature-digest.js` の `getEvidenceDigestDetails` を使ってRFC 8785 JCS正規化とSHA-256ダイジェスト生成を行い、その後 `signDigest` を呼び出す
    - `canonicalization`・`hashAlgorithm`・`signatureAlgorithm`・`canonicalJson`・`digestHex`・`signature`・`signatureBase64`・`kmsKeyId`・`signingAlgorithm`・`signedAt`（ISO 8601 UTC）を含むオブジェクトを返す
    - `verifyEvidenceSignature(evidence, signature)`: 同一の `getEvidenceDigestDetails` でダイジェストを再計算し、`verifyDigestSignature` で検証した結果を返す
    - `signatureBase64` フィールドは `signature` Buffer を `toString('base64')` したものと等しくなるよう保証する
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.1_

- [ ] 3. Aurora PostgreSQL 署名イベントロガーの実装
  - 注意: Amazon QLDB は 2025年7月31日にサービス完全終了済み。AWS公式移行推奨先である Amazon Aurora PostgreSQL（append-onlyテーブル設計）で同等の署名イベントログ機能を実装する。
  - [ ] 3.1 `lib/pg-signing-logger.js` を作成する
    - `PgSigningLogger` クラスを定義し、コンストラクターで `pg`（node-postgres）クライアントまたはプールを注入できる設計にする（テスト時にモッククライアントを差し込めるようにする）
    - `logSigningEvent(eventRecord)` メソッドを実装し、`schemas/signing-event.schema.json` を用いてAJVスキーマ検証を実行する
    - スキーマ検証失敗時はDB書き込みをスキップし、バリデーションエラーをコンソールログに記録する
    - `signing_events` テーブルへの `INSERT` を実装する（`event_id`・`event_type`・`evidence_id`・`digest_hex`・`kms_key_id`・`signing_algorithm`・`signed_at`・`signer_role_arn`・`status`・`valid`・`created_at` カラム）
    - テーブルは append-only 設計とし、`UPDATE`・`DELETE` は行わない（不変性を保証）
    - DB書き込み失敗時はエラーをコンソールログに記録し、例外を再スローしない（非ブロッキング）
    - _要件: 3.1, 3.2, 3.3, 3.5, 3.6, 4.3, 4.4_

  - [ ] 3.2 `AwsKmsProvider` に Aurora PostgreSQL ロガー呼び出しを統合する
    - `signEvidence` 正常完了後、`eventType: "SIGN"` の `Signing_Event_Record` を `PgSigningLogger.logSigningEvent` で非同期書き込む（`await` せず `.catch(console.error)` パターンで非ブロッキングにする）
    - `verifyEvidenceSignature` 完了後、`eventType: "VERIFY"` と検証結果（`valid: true/false`）を含む `Signing_Event_Record` を同様に書き込む
    - `AwsKmsProvider` コンストラクターでロガーインスタンスも外部注入できるようにし、テスト時にモックを差し込めるようにする
    - _要件: 3.1, 3.3, 3.4, 3.5_

  - [ ] 3.3 Aurora PostgreSQL の `signing_events` テーブルDDLを作成する
    - `docs/pg-signing-events-schema.sql` に CREATE TABLE 文を記述する
    - `event_id UUID PRIMARY KEY`・`event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('SIGN', 'VERIFY'))`・`digest_hex CHAR(64) NOT NULL`・`created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` を含む
    - `DELETE` 権限を署名ロール・検証ロールから剥奪するコメントを記述し、append-only の運用方針を明記する
    - `package.json` の `dependencies` に `"pg": "^8.0.0"` を固定バージョンで追加する
    - _要件: 3.1, 3.2_

- [ ] 4. チェックポイント — ここまでの動作確認
  - 既存テストスイートを `USE_KMS` 未設定で実行し、全テストがパスすることを確認する。問題があればユーザーに報告する。

- [ ] 5. `lib/signature.js` ファサードの更新
  - [ ] 5.1 `USE_KMS` 環境変数によるプロバイダー切り替えを実装する
    - `process.env.USE_KMS === 'true'` の場合、`AwsKmsProvider` をデフォルトプロバイダーとしてインスタンス化して使用する
    - `USE_KMS` 未設定または `'false'` の場合、既存の `LocalEcdsaProvider` を引き続き使用する（後方互換性維持）
    - `AwsKmsProvider` を `module.exports` に追加し、外部から参照できるようにする
    - 既存のすべてのエクスポート（`signEvidence`・`verifyEvidenceSignature`・`signDigest`・`verifyDigestSignature`・`generateEcKeyPair`・`LocalEcdsaProvider` 等）は一切変更しない
    - _要件: 8.1, 8.3, 8.4, 8.5_

- [ ] 6. KMS CLIスクリプトの実装
  - [ ] 6.1 `scripts/kms-sign-evidence.js` を作成する
    - コマンドライン引数から証拠JSONファイルパスを受け取り、`loadEvidenceFromFile` でロードする
    - `KMS_KEY_ID` 環境変数未設定の場合、エラーメッセージを出力して終了コード1で終了する
    - `AwsKmsProvider` の `signEvidence` を呼び出し、署名結果を `signatures/{evidenceId}.kms.sig` に保存する
    - `kmsKeyId`・`signingAlgorithm`・`digestHex`・`signedAt` を標準出力に出力する
    - _要件: 7.1, 7.3, 7.4_

  - [ ] 6.2 `scripts/kms-verify-evidence.js` を作成する
    - コマンドライン引数から証拠JSONファイルパスと署名ファイルパスを受け取る
    - `AwsKmsProvider` の `verifyEvidenceSignature` を呼び出し、`VALID` または `INVALID` を標準出力に出力する
    - 検証失敗時はその理由（ダイジェスト不一致・署名検証失敗・スキーマ検証失敗）を出力し、終了コード1で終了する
    - _要件: 7.2, 7.5_

  - [ ] 6.3 `package.json` を更新する
    - `scripts` フィールドに `"kms:sign": "node scripts/kms-sign-evidence.js"` を追加する
    - `scripts` フィールドに `"kms:verify": "node scripts/kms-verify-evidence.js"` を追加する
    - `scripts` フィールドに `"test:aws:kms": "node --test tests/aws-kms-provider.integration.js"` を追加する
    - `dependencies` に `"@aws-sdk/client-kms": "^3.0.0"` を追加する（`npm install @aws-sdk/client-kms --save-exact` で固定バージョンを使用）
    - _要件: 7.6, 9.5_

- [ ] 7. モックベース単体テストの実装
  - [ ] 7.1 `tests/aws-kms-provider.test.js` を作成する — モック設定と正常系テスト
    - Node.js 組み込みの `node:test` と `node:assert` を使用する（既存テストと同じフレームワーク）
    - `@aws-sdk/client-kms` の `KMSClient.send` をモック化し、実際のKMS API呼び出しを行わないようにする
    - `signEvidence` 正常系：モックが有効なDER署名を返す場合に、期待されるすべてのフィールド（`canonicalization`・`hashAlgorithm`・`signatureAlgorithm`・`canonicalJson`・`digestHex`・`signature`・`signatureBase64`・`kmsKeyId`・`signingAlgorithm`・`signedAt`）が含まれることを検証する
    - `verifyEvidenceSignature` 正常系：モックが `SignatureValid: true` を返す場合に `valid: true` が返ることを検証する
    - `signEvidence` を同一証拠で2回呼び出した場合に `digestHex` が同じ値であることを検証する（冪等性）
    - `signatureBase64` が `signature` Buffer の Base64 エンコードと等しいことを検証する
    - _要件: 9.2, 9.3, 9.4, 10.1_

  - [ ] 7.2 `tests/aws-kms-provider.test.js` にエラーハンドリングテストを追加する
    - `KMS_KEY_ID` 未設定時に `Error: KMS_KEY_ID environment variable is required` がスローされることを検証する
    - KMS API 呼び出し失敗時にエラーがラップされ、KMSオペレーション名を含むエラーメッセージがスローされることを検証する
    - DERデコード処理：既知のDER署名バイト列を入力し、デコードされた r・s 各32バイトが正しい値であることを検証する
    - _要件: 1.6, 1.7, 9.3, 10.3_

  - [ ]* 7.3 DER ラウンドトリップのプロパティテストを `tests/aws-kms-provider.test.js` に追加する
    - **プロパティ1: Base64ラウンドトリップ** — ランダムな64バイト `Buffer` を生成し、Base64エンコード→デコードで元の値と等しいことを検証（1000回以上反復）
    - **プロパティ2: DERラウンドトリップ** — ランダムなr値・s値（各32バイト）からDER署名を生成し、デコード後のr・sが元の値と等しいことを検証（1000回以上反復）
    - **検証対象: 要件 10.2, 10.4**
    - 外部PBTライブラリを使わず `crypto.randomBytes` とループで実装する（既存依存関係を増やさない）

- [ ] 8. チェックポイント — 全テストの確認
  - `npm test` を実行し、既存テストが全てパスすることを確認する。`USE_KMS` 未設定での後方互換性を明示的に確認する。問題があればユーザーに報告する。

- [ ]* 9. AWS統合テストの実装（オプション）
  - [ ]* 9.1 `tests/aws-kms-provider.integration.js` を作成する
    - 実際の `@aws-sdk/client-kms` クライアントを使用し、`KMS_KEY_ID` 環境変数で指定されたキーに対してエンドツーエンドの署名・検証フローを実行する
    - `signEvidence` → `verifyEvidenceSignature` のラウンドトリップが `valid: true` を返すことを検証する
    - `npm run test:aws:kms` で実行できるように `node:test` 形式で記述する
    - _要件: 9.5_

- [ ] 10. CloudTrail・IAM ドキュメントの作成
  - [ ] 10.1 `docs/cloudtrail-audit-config.md` を作成する
    - CloudTrail トレイルの有効化設定例（対象リージョン・S3バケット設定・Log File Validation の有効化）を記述する
    - ログに記録される KMS API イベント一覧（`kms:Sign`・`kms:Verify`・`kms:GetPublicKey`・`kms:CreateKey`・`kms:ScheduleKeyDeletion`・`kms:DisableKey`・`kms:PutKeyPolicy`）を記述する
    - `kms:Sign` イベントに含まれるフィールド（呼び出し元IAMプリンシパルARN・リクエスト時刻・使用キーID・リージョン）を説明する
    - KMS API 呼び出しを VPC エンドポイント（Interface型: `com.amazonaws.<region>.kms`）経由に限定し、パブリックインターネット経由の通信を拒否するエンドポイントポリシー例（`aws:sourceVpce` 条件キーを使用した Deny ステートメント）を記述する
    - _要件: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 10.2 `docs/iam-least-privilege-policy.md` を作成する
    - 署名ロール用IAMポリシー例（`kms:Sign`・`kms:GetPublicKey` のみ、特定キーARNへのリソーススコープ）を JSON 形式で記述する
    - 検証ロール用IAMポリシー例（`kms:Verify`・`kms:GetPublicKey` のみ）を JSON 形式で記述する
    - KMSキー管理ロール用IAMポリシー例（`kms:CreateKey`・`kms:ScheduleKeyDeletion`・`kms:DisableKey`・`kms:PutKeyPolicy`、`kms:Sign`・`kms:Verify` は除外）を JSON 形式で記述する
    - KMSキー管理ロールのポリシーに、`kms:ScheduleKeyDeletion` を呼び出す際の `PendingWindowInDays` を最低30日（推奨値）に設定する運用ルールと、その理由（署名済み証拠の検証に必要なキーの誤削除防止）を記述する
    - 権限のないIAMプリンシパルが `kms:Sign` を呼び出した場合の `AccessDeniedException` 動作を説明する
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5_

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保している
- チェックポイントタスクにより段階的な動作確認を行う
- 単体テストは AWS 接続なしで実行可能（モックインジェクション）
- 統合テスト（タスク9）は `KMS_KEY_ID` を持つ AWS 環境でのみ実行する
- `lib/signature.js` の既存エクスポートは一切変更しないこと（後方互換性必須）
- `@aws-sdk/client-kms` の依存追加は `package.json` の `dependencies` に固定バージョンで追加すること
- Ethereum 等オンチェーン送信に必要な recovery id（v 値）の算出は本フェーズの対象外とする（将来の Phase 3 以降で検討）

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.5"] },
    { "id": 5, "tasks": ["2.4", "3.2"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3", "9.1", "10.1", "10.2"] }
  ]
}
```
