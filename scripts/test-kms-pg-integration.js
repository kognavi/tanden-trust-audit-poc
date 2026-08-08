#!/usr/bin/env node
/**
 * test-kms-pg-integration.js
 *
 * AWS KMS 署名 ＋ PostgreSQL 格納の統合テストスクリプト。
 *
 * 実行手順:
 *   node scripts/test-kms-pg-integration.js
 *
 * 必要な環境変数（.envに設定済みであること）:
 *   KMS_KEY_ID  - AWS KMS キー ID (ARN)
 *   AWS_REGION  - AWS リージョン
 *   PG_HOST     - PostgreSQL ホスト
 *   PG_PORT     - PostgreSQL ポート
 *   PG_DATABASE - データベース名
 *   PG_USER     - ユーザー名
 *   PG_PASSWORD - パスワード
 *
 * テストフロー:
 *   1. .env 読み込み & 環境変数確認
 *   2. pg.Pool 接続確認
 *   3. PgEvidenceStore スキーマ初期化
 *   4. AwsKmsProvider による Evidence 署名
 *   5. PgEvidenceStore への署名済み Evidence 保存
 *   6. 保存済み Evidence の取得と内容確認
 *   7. 署名検証（KMS）
 *   8. クリーンアップ（テストデータ削除）
 */

"use strict";

require("dotenv").config();
const { Pool } = require("pg");
const { AwsKmsProvider } = require("../lib/aws-kms-provider");
const { PgEvidenceStore } = require("../lib/pg-evidence-store");

// ─── ユーティリティ ────────────────────────────────────────────────
function log(step, message, data) {
  const prefix = `[Step ${step}]`;
  console.log(`\n${prefix} ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function pass(step, message) {
  console.log(`  ✅ PASS: ${message}`);
}

function fail(step, message, error) {
  console.error(`  ❌ FAIL: ${message}`);
  if (error) console.error("  Error:", error.message || error);
}

// ─── テストデータ ──────────────────────────────────────────────────
const TEST_EVIDENCE = {
  type: "ConsentRecord",
  version: "1.0",
  subject: "user-12345",
  action: "data_processing_consent",
  timestamp: new Date().toISOString(),
  metadata: {
    purpose: "KMS-PG統合テスト",
    source: "test-kms-pg-integration.js",
  },
};

const TEST_OBJECT_KEY = `test/kms-pg-integration/${Date.now()}`;

// ─── メイン ────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  KMS + PostgreSQL 統合テスト");
  console.log("=".repeat(60));

  let pool;
  let store;
  let testFailed = false;

  // ── Step 1: 環境変数確認 ────────────────────────────────────────
  log(1, "環境変数の確認");
  const required = ["KMS_KEY_ID", "AWS_REGION", "PG_HOST", "PG_PORT", "PG_DATABASE", "PG_USER", "PG_PASSWORD"];
  // `k` はこのスクリプト内でハードコードされた文字列リテラルの配列から来るため、
  // 外部入力による Object Injection リスクは存在しない。
  // process.env へのアクセスキーが攻撃者に制御される経路はない。
  const missing = required.filter((k) => !process.env[k]); // eslint-disable-line security/detect-object-injection

  if (missing.length > 0) {
    fail(1, `必須の環境変数が未設定: ${missing.join(", ")}`);
    fail(1, ".env ファイルを確認してください");
    process.exit(1);
  }

  pass(1, `全環境変数が設定済み`);
  console.log(`  KMS_KEY_ID : ${process.env.KMS_KEY_ID}`);
  console.log(`  AWS_REGION : ${process.env.AWS_REGION}`);
  console.log(`  PG         : ${process.env.PG_USER}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`);

  // ── Step 2: PostgreSQL 接続確認 ─────────────────────────────────
  log(2, "PostgreSQL 接続テスト");
  try {
    pool = new Pool({
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      connectionTimeoutMillis: 5000,
    });

    const pingResult = await pool.query("SELECT current_database(), now()");
    pass(2, `接続成功: DB=${pingResult.rows[0].current_database}, time=${pingResult.rows[0].now}`);
  } catch (error) {
    fail(2, "PostgreSQL 接続失敗", error);
    console.error("\nDocker が起動しているか確認してください:");
    console.error("  docker-compose up -d");
    process.exit(1);
  }

  // ── Step 3: スキーマ初期化 ──────────────────────────────────────
  log(3, "PgEvidenceStore スキーマ初期化");
  try {
    store = new PgEvidenceStore({ pool });
    await store.initializeSchema();
    pass(3, "evidence_objects テーブル作成 (または確認) 完了");
  } catch (error) {
    fail(3, "スキーマ初期化失敗", error);
    testFailed = true;
  }

  // ── Step 4: KMS 署名 ────────────────────────────────────────────
  log(4, "AWS KMS による Evidence 署名");
  // signatureBuffer : Buffer（64バイト Raw形式）― verifyEvidenceSignature() に渡す
  // signatureBase64 : Base64文字列 ― DB 保存に使用
  let signatureBuffer;
  let signatureBase64;
  let provider;
  try {
    provider = new AwsKmsProvider();
    const signResult = await provider.signEvidence(TEST_EVIDENCE);
    signatureBuffer = signResult.signature;
    signatureBase64 = signResult.signatureBase64;
    pass(4, `署名成功`);
    console.log(`  署名 (先頭64文字): ${signatureBase64.substring(0, 64)}...`);
  } catch (error) {
    fail(4, "KMS 署名失敗", error);
    testFailed = true;
  }

  // ── Step 5: PgEvidenceStore への保存 ────────────────────────────
  // DB には文字列（Base64）で保存する。Buffer をそのまま渡すと型エラーになる。
  log(5, `PgEvidenceStore への保存 (key: ${TEST_OBJECT_KEY})`);
  let putResult;
  try {
    putResult = await store.put(TEST_OBJECT_KEY, TEST_EVIDENCE, signatureBase64 || null);
    pass(5, "保存成功");
    log(5, "保存結果:", putResult);
  } catch (error) {
    fail(5, "保存失敗", error);
    testFailed = true;
  }

  // ── Step 6: 取得と内容確認 ──────────────────────────────────────
  log(6, "保存済み Evidence の取得・内容確認");
  let retrievedSignatureBuffer;  // DB から復元した Buffer（Step 7 の検証用）
  try {
    const fetched = await store.get(TEST_OBJECT_KEY);
    if (!fetched) {
      fail(6, "get() が null を返した（レコードが見つからない）");
      testFailed = true;
    } else {
      pass(6, "取得成功");

      // subject フィールドの一致確認
      if (fetched.evidence.subject === TEST_EVIDENCE.subject) {
        pass(6, `evidence.subject 一致: "${fetched.evidence.subject}"`);
      } else {
        fail(6, `evidence.subject 不一致: expected "${TEST_EVIDENCE.subject}", got "${fetched.evidence.subject}"`);
        testFailed = true;
      }

      // 署名の一致確認（Base64 文字列同士で比較）
      if (signatureBase64 && fetched.signature === signatureBase64) {
        pass(6, "signature 一致（Base64文字列）");
        // 検証用に Base64 → Buffer へ復元
        retrievedSignatureBuffer = Buffer.from(fetched.signature, "base64");

        // H6 バイトレベル完全一致の保証:
        // KMS が直接返した署名 Buffer（signatureBuffer）と、
        // DB に TEXT として保存後に Base64 デコードで復元した Buffer が
        // バイト単位で一致することを確認する。
        // Base64 文字列の一致だけでは、DBドライバーや PG の TEXT 型が
        // 文字コード変換を行った場合のサイレントな劣化を検出できないため。
        if (Buffer.compare(retrievedSignatureBuffer, signatureBuffer) === 0) {
          pass(6, "署名 Buffer バイト完全一致（DB保存/復元後も劣化なし）");
        } else {
          fail(6, "署名 Buffer バイト不一致（DB経由で署名が変化した可能性）");
          testFailed = true;
        }
      } else if (!signatureBase64) {
        pass(6, "署名なしのため signature チェックスキップ");
      } else {
        fail(6, "signature 不一致");
        testFailed = true;
      }
    }
  } catch (error) {
    fail(6, "取得失敗", error);
    testFailed = true;
  }

  // ── Step 7: 署名検証 ────────────────────────────────────────────
  // verifyEvidenceSignature() は Buffer を要求するため、DB から復元した
  // retrievedSignatureBuffer を渡す。
  log(7, "KMS による署名検証");
  if (retrievedSignatureBuffer && provider) {
    try {
      const isValid = await provider.verifyEvidenceSignature(TEST_EVIDENCE, retrievedSignatureBuffer);
      if (isValid) {
        pass(7, "署名検証 OK（改ざんなし確認）");
      } else {
        fail(7, "署名検証 NG（改ざんまたは鍵不一致）");
        testFailed = true;
      }
    } catch (error) {
      fail(7, "署名検証エラー", error);
      testFailed = true;
    }
  } else {
    console.log("  ⚠️  SKIP: 署名が取得できなかったためスキップ");
  }

  // ── Step 8: クリーンアップ ──────────────────────────────────────
  log(8, "テストデータのクリーンアップ");
  try {
    const deleted = await store.delete(TEST_OBJECT_KEY);
    if (deleted) {
      pass(8, `テストレコード削除完了 (key: ${TEST_OBJECT_KEY})`);
    } else {
      console.log(`  ⚠️  SKIP: 削除対象レコードなし（Step 5 で保存失敗の可能性）`);
    }
  } catch (error) {
    fail(8, "クリーンアップ失敗", error);
    // クリーンアップ失敗は testFailed に含めない（テスト本体ではないため）
  } finally {
    if (pool) await pool.end();
  }

  // ── 結果サマリ ─────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  if (testFailed) {
    console.error("  ❌ 統合テスト FAILED（上記のエラーを確認してください）");
    process.exit(1);
  } else {
    console.log("  ✅ 統合テスト ALL PASSED");
  }
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n予期しないエラーが発生しました:", error);
  process.exit(1);
});
