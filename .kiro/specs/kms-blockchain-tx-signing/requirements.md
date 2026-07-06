# 要件定義書

## はじめに

本機能は、既存の `tanden-trust-audit-poc` リポジトリに対して、AWS KMS（キーアルゴリズム：`ECC_SECG_P256K1`）を用いたブロックチェーントランザクション署名基盤を追加するものである。

`ECC_SECG_P256K1` は Bitcoin・Ethereum が採用する secp256k1 曲線であり、ブロックチェーンエコシステムとの互換性を持つ。秘密鍵はAWS KMS内のHSM（Hardware Security Module）に封じ込め、アプリケーションコードに秘密鍵マテリアルが露出しないことを保証する。

加えて、AWS CloudTrail によるKMS API呼び出しの不変監査ログと、Amazon Aurora PostgreSQL（append-onlyテーブル設計）による署名イベントの改ざん困難な台帳管理を組み合わせ、エンタープライズ要件を満たす監査証跡基盤を実現する。

本機能は、既存の `signatures/`・`schemas/`・`scripts/` フォルダおよびプロバイダー抽象（`LocalEcdsaProvider`）と整合的に統合される。

---

## 用語集

- **KMS_Provider**: `lib/aws-kms-provider.js` として実装される、AWS KMS を使用した署名プロバイダーモジュール
- **Local_Provider**: 既存の `lib/local-ecdsa-provider.js`。ローカルECDSA P-256 署名プロバイダー
- **Signing_Facade**: 既存の `lib/signature.js`。署名・検証の公開ファサードモジュール
- **Digest_Module**: 既存の `lib/signature-digest.js`。RFC 8785 JCS 正規化 + SHA-256 ダイジェスト生成モジュール
- **Evidence_Record**: `schemas/evidence.schema.json` に準拠した監査証拠JSONオブジェクト
- **Signing_Event_Record**: Aurora PostgreSQL の `signing_events` テーブルに記録される署名イベントの構造化レコード。`schemas/signing-event.schema.json` で定義
- **Pg_Signing_Logger**: `lib/pg-signing-logger.js` として実装される、Aurora PostgreSQL の `signing_events` テーブルへ署名イベントを append-only で記録するロガーモジュール（Amazon QLDB は 2025年7月31日にサービス完全終了のため移行）
- **CloudTrail**: AWS CloudTrail によるKMS API呼び出しの不変監査ログサービス
- **HSM**: Hardware Security Module。KMSキーの秘密鍵マテリアルを保護するハードウェアセキュリティモジュール
- **secp256k1**: Bitcoin・Ethereum で採用される楕円曲線。AWS KMS では `ECC_SECG_P256K1` キースペックに対応
- **DER_Signature**: KMS Sign APIが返すDER（Distinguished Encoding Rules）エンコードされたECDSA署名
- **Raw_Signature**: DER署名をデコードし、r値とs値を64バイト（各32バイト）に正規化したIEEE P1363形式の署名
- **Public_Key_DER**: KMS GetPublicKey APIが返すSPKI DER形式の公開鍵バイト列
- **KMS_Key_ID**: AWS KMSキーのARNまたはエイリアス。環境変数 `KMS_KEY_ID` で注入
- **Signing_Algorithm**: 本機能では `ECDSA_SHA_256` を使用（KMS側で secp256k1 + SHA-256 に対応）
- **CLI_Script**: `scripts/` フォルダ配下のコマンドラインスクリプト

---

## 要件

### 要件1：AWS KMS プロバイダーの実装

**ユーザーストーリー：** 開発者として、AWS KMS を使ったブロックチェーン署名プロバイダーを利用したい。秘密鍵をHSM内に封じ込めたまま、既存の証拠レコードへの署名・検証フローを維持できるようにしたい。

#### 受け入れ基準

1. THE `KMS_Provider` SHALL `LocalEcdsaProvider` と同一の署名インターフェース（`signEvidence`・`verifyEvidenceSignature`・`signDigest`・`verifyDigestSignature` メソッド）を公開する
2. WHEN `KMS_Provider` が `signDigest` を呼び出す場合、THE `KMS_Provider` SHALL AWS KMS Sign API を `ECDSA_SHA_256` アルゴリズムで呼び出し、`KMS_Key_ID` で識別されるキーを使用する
3. WHEN AWS KMS Sign API が `DER_Signature` を返す場合、THE `KMS_Provider` SHALL DER エンコードをデコードし、r値とs値を各32バイトに正規化した64バイトの `Raw_Signature` を返す
4. WHEN `KMS_Provider` が `verifyDigestSignature` を呼び出す場合、THE `KMS_Provider` SHALL AWS KMS Verify API を呼び出し、署名の有効性を検証した結果を返す
5. THE `KMS_Provider` SHALL `getPublicKey` メソッドを提供し、AWS KMS GetPublicKey API から `Public_Key_DER` を取得して返す
6. IF `KMS_Key_ID` 環境変数が未設定の場合、THEN THE `KMS_Provider` SHALL 初期化時に `Error: KMS_KEY_ID environment variable is required` というメッセージのエラーをスローする
7. IF AWS KMS API 呼び出しが失敗した場合、THEN THE `KMS_Provider` SHALL 元のAWSエラーをラップし、エラーメッセージにKMSオペレーション名を含む `Error` をスローする
8. THE `KMS_Provider` SHALL 秘密鍵マテリアルをメモリ上またはディスク上に保持しない

---

### 要件2：証拠レコードのKMS署名フロー

**ユーザーストーリー：** システム管理者として、証拠レコードをKMSで署名したい。既存のJSONスキーマ検証・RFC 8785正規化・SHA-256ダイジェストのパイプラインを経由し、KMSで署名結果と署名メタデータが得られるようにしたい。

#### 受け入れ基準

1. WHEN `KMS_Provider` の `signEvidence` が `Evidence_Record` を受け取る場合、THE `KMS_Provider` SHALL `Digest_Module` を使ってRFC 8785 JCS正規化とSHA-256ダイジェスト生成を行い、その後KMS署名を実行する
2. WHEN `signEvidence` が成功した場合、THE `KMS_Provider` SHALL `canonicalization`・`hashAlgorithm`・`signatureAlgorithm`・`canonicalJson`・`digestHex`・`signature`・`signatureBase64`・`kmsKeyId`・`signingAlgorithm`・`signedAt` フィールドを含むオブジェクトを返す
3. WHEN `signEvidence` が成功した場合、THE `KMS_Provider` SHALL `signedAt` フィールドにISO 8601形式のUTCタイムスタンプを設定する
4. THE `KMS_Provider` SHALL `LocalEcdsaProvider` が返す `signEvidence` レスポンスと互換性のあるフィールド構造を返す（`canonicalization`・`hashAlgorithm`・`signatureAlgorithm`・`signature`・`signatureBase64`・`digestHex` は共通）
5. WHEN `verifyEvidenceSignature` が `Evidence_Record` と署名を受け取る場合、THE `KMS_Provider` SHALL 同一の `Digest_Module` を用いてダイジェストを再計算し、KMS Verify API で署名を検証した結果を返す
6. WHEN 同一の `Evidence_Record` に対して `signEvidence` を2回呼び出す場合、THE `KMS_Provider` SHALL 2回目も同じ `digestHex` を返す（ダイジェスト生成の冪等性）

---

### 要件3：署名イベントの Aurora PostgreSQL 記録

**ユーザーストーリー：** コンプライアンス担当者として、すべての署名・検証イベントをAurora PostgreSQLのappend-onlyテーブルに改ざん困難な形で記録したい。後から任意のイベントを追跡・検証できるようにしたい。

> **注記：** Amazon QLDB は 2025年7月31日にサービス完全終了済み。AWS公式移行推奨先である Amazon Aurora PostgreSQL（append-onlyテーブル設計）で同等の署名イベントログ機能を実装する。

#### 受け入れ基準

1. WHEN `KMS_Provider` が `signEvidence` を正常完了した場合、THE `Pg_Signing_Logger` SHALL Aurora PostgreSQL の `signing_events` テーブルに `Signing_Event_Record` を書き込む
2. THE `Signing_Event_Record` SHALL `eventId`・`eventType`・`evidenceId`・`digestHex`・`kmsKeyId`・`signingAlgorithm`・`signedAt`・`signerRoleArn`・`status` フィールドを含む
3. WHEN `KMS_Provider` が `verifyEvidenceSignature` を呼び出した場合、THE `Pg_Signing_Logger` SHALL `signing_events` テーブルに `eventType: "VERIFY"` の `Signing_Event_Record` と検証結果（`valid: true/false`）を書き込む
4. THE `signing_events` テーブルは append-only 設計とし、`UPDATE`・`DELETE` 操作を署名ロールおよび検証ロールから権限レベルで禁止する
5. IF `Pg_Signing_Logger` への書き込みが失敗した場合、THEN THE `KMS_Provider` SHALL エラーをログに記録し、署名・検証の主処理結果をそのまま返す（DB書き込み失敗は主処理を妨げない）
6. THE `Signing_Event_Record` SHALL `schemas/signing-event.schema.json` で定義されたJSONスキーマに準拠する

---

### 要件4：署名イベントスキーマの定義

**ユーザーストーリー：** 開発者として、署名イベントレコードの構造を明確に定義したい。スキーマ検証により、不正な形式のイベントがDBに書き込まれることを防ぎたい。

#### 受け入れ基準

1. THE `Signing_Facade` SHALL `schemas/signing-event.schema.json` ファイルを提供し、`Signing_Event_Record` の必須フィールド・型・フォーマット制約を定義する
2. THE `schemas/signing-event.schema.json` SHALL `eventId`（UUID形式文字列）・`eventType`（`"SIGN"` または `"VERIFY"` の列挙型）・`evidenceId`（既存のevidenceIdパターン）・`digestHex`（64文字の16進数文字列）・`kmsKeyId`（文字列）・`signingAlgorithm`（文字列）・`signedAt`（ISO 8601 date-time）を必須フィールドとして定義する
3. WHEN `Signing_Event_Record` を Aurora PostgreSQL に書き込む前に、THE `Pg_Signing_Logger` SHALL `schemas/signing-event.schema.json` を用いてスキーマ検証を実行する
4. IF `Signing_Event_Record` がスキーマ検証に失敗した場合、THEN THE `Pg_Signing_Logger` SHALL DB書き込みをスキップし、バリデーションエラーの詳細をログに記録する

---

### 要件5：CloudTrailによるKMS API監査

**ユーザーストーリー：** セキュリティ監査者として、すべてのKMS署名・検証・キー操作がCloudTrailに自動記録されることを確認したい。誰がいつどのキーでどの操作を行ったかを追跡できるようにしたい。

#### 受け入れ基準

1. THE `CloudTrail` SHALL 本機能で使用するすべてのAWSリージョンとアカウントで有効化されたトレイルを持つ
2. THE `CloudTrail` SHALL `kms:Sign`・`kms:Verify`・`kms:GetPublicKey`・`kms:CreateKey`・`kms:ScheduleKeyDeletion`・`kms:DisableKey`・`kms:PutKeyPolicy` の各APIイベントをログに記録する
3. THE `CloudTrail` SHALL ログファイルをS3バケットに保存し、S3バケットのオブジェクトポリシーによってCloudTrail以外からの上書き・削除を拒否する
4. THE `CloudTrail` SHALL CloudTrailログのS3への配信に対してログファイル整合性検証（Log File Validation）を有効化する
5. WHILE `CloudTrail` トレイルが有効である場合、THE `CloudTrail` SHALL `kms:Sign` イベントに呼び出し元IAMプリンシパルARN・リクエスト時刻・使用キーID・リージョンを含める
6. THE システム SHALL KMS API 呼び出しを VPC エンドポイント（Interface型：`com.amazonaws.<region>.kms`）経由に限定し、`aws:sourceVpce` 条件キーを用いてパブリックインターネット経由の KMS API 呼び出しを拒否するエンドポイントポリシーを当該 VPC エンドポイントに適用する

---

### 要件6：IAMアクセス制御と最小権限

**ユーザーストーリー：** セキュリティエンジニアとして、署名・検証・管理の各操作に対して最小権限のIAMポリシーを適用したい。署名権限と鍵管理権限を分離することで、内部脅威リスクを低減したい。

#### 受け入れ基準

1. THE `KMS_Provider` を呼び出す署名ロールは `kms:Sign`・`kms:GetPublicKey` の権限のみを持ち、`kms:ScheduleKeyDeletion`・`kms:DisableKey`・`kms:PutKeyPolicy` の権限を持たない
2. THE `KMS_Provider` を呼び出す検証ロールは `kms:Verify`・`kms:GetPublicKey` の権限のみを持ち、`kms:Sign` の権限を持たない
3. KMSキー管理ロールは `kms:CreateKey`・`kms:ScheduleKeyDeletion`・`kms:DisableKey`・`kms:PutKeyPolicy` の権限を持つが、`kms:Sign`・`kms:Verify` の権限を持たない
4. THE `KMS_Provider` の実行に使用するIAMロールの権限は、特定の `KMS_Key_ID` のARNに限定された `Resource` スコープを持つ
5. IF 権限のないIAMプリンシパルがKMS Sign APIを呼び出した場合、THEN AWS KMS SHALL `AccessDeniedException` を返す
6. WHEN KMSキー管理ロールが `kms:ScheduleKeyDeletion` を呼び出す場合、THE システム SHALL `PendingWindowInDays` を最低30日に設定することを必須とする。これは、署名済み証拠の検証に必要なキーが保留期間前に誤って削除されることを防ぐためである

---

### 要件7：KMS CLIスクリプトの提供

**ユーザーストーリー：** 開発者として、既存の `scripts/sign-evidence.js`・`scripts/verify-signature.js` に対応するKMS版のCLIスクリプトを使いたい。ローカル署名とKMS署名を同じインターフェースで切り替えて操作できるようにしたい。

#### 受け入れ基準

1. THE `CLI_Script` `scripts/kms-sign-evidence.js` SHALL コマンドライン引数として証拠JSONファイルパスを受け取り、KMS署名を実行し、署名結果を `signatures/` ディレクトリに `{evidenceId}.kms.sig` ファイルとして保存する
2. THE `CLI_Script` `scripts/kms-verify-evidence.js` SHALL コマンドライン引数として証拠JSONファイルパスと署名ファイルパスを受け取り、KMS検証を実行し、`VALID` または `INVALID` の結果を標準出力に出力する
3. WHEN `scripts/kms-sign-evidence.js` が実行される場合、THE `CLI_Script` SHALL `KMS_Key_ID` 環境変数が設定されていることを確認し、未設定の場合はエラーメッセージとともに終了コード1で終了する
4. WHEN `scripts/kms-sign-evidence.js` が正常に署名を完了した場合、THE `CLI_Script` SHALL 署名に使用した `kmsKeyId`・`signingAlgorithm`・`digestHex`・`signedAt` を標準出力に出力する
5. WHEN `scripts/kms-verify-evidence.js` が `INVALID` の結果を返す場合、THE `CLI_Script` SHALL 検証失敗の理由（ダイジェスト不一致・署名検証失敗・スキーマ検証失敗）を標準出力に出力し、終了コード1で終了する
6. THE `CLI_Script` `scripts/kms-sign-evidence.js` および `scripts/kms-verify-evidence.js` SHALL `package.json` の `scripts` フィールドに `kms:sign` および `kms:verify` エントリとして登録される

---

### 要件8：既存アーキテクチャとの統合

**ユーザーストーリー：** 開発者として、KMS署名基盤を既存の `lib/signature.js` ファサードおよびプロバイダーパターンと整合的に統合したい。既存のテストや `LocalEcdsaProvider` を使ったスクリプトが引き続き動作することを保証したい。

#### 受け入れ基準

1. THE `Signing_Facade` `lib/signature.js` SHALL 既存のエクスポート（`signEvidence`・`verifyEvidenceSignature`・`signDigest`・`verifyDigestSignature`・`generateEcKeyPair`・`LocalEcdsaProvider` 等）を変更なく維持する
2. THE `KMS_Provider` SHALL `Digest_Module` `lib/signature-digest.js` をそのまま使用し、正規化とダイジェスト生成のロジックを複製しない
3. WHERE `USE_KMS=true` 環境変数が設定されている場合、THE `Signing_Facade` SHALL デフォルトプロバイダーとして `KMS_Provider` を使用する
4. WHILE `USE_KMS` 環境変数が未設定または `false` である場合、THE `Signing_Facade` SHALL 既存の `LocalEcdsaProvider` をデフォルトプロバイダーとして使用する（後方互換性の維持）
5. THE `KMS_Provider` SHALL `lib/aws-kms-provider.js` というファイル名で `lib/` ディレクトリに配置する
6. WHEN 既存のテストスイートを `USE_KMS` 未設定の状態で実行した場合、THE `Signing_Facade` SHALL 既存のすべてのテストがパスする状態を維持する

---

### 要件9：KMSプロバイダーのテスト戦略

**ユーザーストーリー：** 開発者として、AWSの実リソースに依存せずKMSプロバイダーの動作をローカルで検証したい。モックを使った単体テストと、AWS環境を使った統合テストを明確に分離したい。

#### 受け入れ基準

1. THE `KMS_Provider` SHALL AWS SDK の `@aws-sdk/client-kms` クライアントを外部注入（コンストラクタインジェクション）できる設計とし、テスト時にモッククライアントを注入できるようにする
2. WHEN `KMS_Provider` の単体テストを実行する場合、THE テストモジュール SHALL AWS SDKクライアントをモックし、実際のKMS API呼び出しを行わずにプロバイダーの振る舞いを検証する
3. THE テストスイート SHALL `signEvidence` の正常系・`verifyEvidenceSignature` の正常系・DER署名デコードの正確性・`KMS_Key_ID` 未設定時のエラー・KMS API失敗時のエラーハンドリングを検証するテストケースを含む
4. WHEN `tests/aws-kms-provider.test.js` を実行する場合、THE テストスイート SHALL AWS接続なしでパスする
5. WHERE AWSテスト環境が利用可能な場合、THE `KMS_Provider` SHALL `tests/aws-kms-provider.integration.js` として統合テストを提供し、`npm run test:aws:kms` コマンドで実行できるようにする

---

### 要件10：パーサー・シリアライザーの正確性（ラウンドトリップ保証）

**ユーザーストーリー：** 開発者として、DER署名のデコードとBase64エンコード/デコードが正確であることを保証したい。署名バイト列の変換ミスによって署名検証が失敗しないようにしたい。

#### 受け入れ基準

1. WHEN 任意の有効な `Evidence_Record` に対して `KMS_Provider` が `signEvidence` を実行した場合、THE `KMS_Provider` SHALL `signature` フィールドの `Buffer` を Base64エンコードした値が `signatureBase64` フィールドと等しいことを保証する
2. FOR ALL 有効な64バイトの `Raw_Signature` において、THE `KMS_Provider` SHALL `signature` を Base64エンコードし、再度デコードした結果が元の `signature` と等しいことを保証する（Base64ラウンドトリップ特性）
3. WHEN KMS Sign API が返す `DER_Signature` を `KMS_Provider` がデコードする場合、THE `KMS_Provider` SHALL デコードされた `Raw_Signature` が元の `DER_Signature` の r値・s値を正確に保持することを保証する
4. FOR ALL 有効な `DER_Signature` において、THE `KMS_Provider` SHALL DERデコード後の `Raw_Signature` を再度DERエンコードした場合に元の `DER_Signature` と等価であることを保証する（DERラウンドトリップ特性）
