"use strict";

/**
 * PgEvidenceStore — Store layer
 *
 * Evidence オブジェクトを PostgreSQL テーブル (`evidence_objects`) に
 * 格納・取得するための Store 層モジュール。
 *
 * 責務:
 *   - Evidenceオブジェクト本体（JSON）とその署名をDBに保存する
 *   - object_key によるユニーク制約でべき等に上書き保存 (upsert) を行う
 *   - 取得・存在確認・削除の基本 CRUD を提供する
 *
 * 注意:
 *   - このモジュールは Sign 層を呼び出してはならない（依存方向ルール）
 *   - 受け取る signature は呼び出し元（AuditManager 等）が既に生成済みのもの
 *   - Ledger 層（PgSigningLogger）への書き込みは行わない
 *
 * @see docs/module-registry.md
 * @see lib/pg-signing-logger.js (Ledger層 — 責務が異なる)
 */
class PgEvidenceStore {
  /**
   * @param {object} options
   * @param {import("pg").Pool} options.pool - pg.Pool インスタンス
   */
  constructor({ pool } = {}) {
    if (!pool || typeof pool.query !== "function") {
      throw new Error(
        "PgEvidenceStore requires a `pool` implementing pg.Pool's query()."
      );
    }
    this._pool = pool;
  }

  /**
   * evidence_objects テーブルを作成する（存在すれば何もしない）。
   * プロセス起動時に1回呼び出せばよい（べき等）。
   */
  async initializeSchema() {
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS evidence_objects (
        id            BIGSERIAL PRIMARY KEY,
        object_key    TEXT        NOT NULL UNIQUE,
        evidence      JSONB       NOT NULL,
        signature     TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  /**
   * Evidence オブジェクトを保存する（upsert）。
   * object_key が既に存在する場合は evidence / signature / updated_at を上書きする。
   *
   * @param {string} objectKey - Evidence の一意識別子（例: "consent/2026/abc123"）
   * @param {object} evidence  - Evidence JSON オブジェクト
   * @param {string} [signature] - 署名文字列（未署名の場合は省略可）
   * @returns {Promise<{id:number, objectKey:string, createdAt:Date, updatedAt:Date}>}
   */
  async put(objectKey, evidence, signature = null) {
    assertValidObjectKey(objectKey);
    if (evidence === null || typeof evidence !== "object") {
      throw new Error("PgEvidenceStore.put: `evidence` must be a non-null object.");
    }

    const result = await this._pool.query(
      `INSERT INTO evidence_objects (object_key, evidence, signature)
       VALUES ($1, $2, $3)
       ON CONFLICT (object_key) DO UPDATE
         SET evidence   = EXCLUDED.evidence,
             signature  = EXCLUDED.signature,
             updated_at = now()
       RETURNING id, object_key, created_at, updated_at`,
      [objectKey, JSON.stringify(evidence), signature]
    );

    const row = result.rows[0];
    return {
      id: Number(row.id),
      objectKey: row.object_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * object_key で Evidence を取得する。
   *
   * @param {string} objectKey
   * @returns {Promise<{objectKey:string, evidence:object, signature:string|null, createdAt:Date, updatedAt:Date} | null>}
   *   見つからない場合は null
   */
  async get(objectKey) {
    assertValidObjectKey(objectKey);

    const result = await this._pool.query(
      `SELECT object_key, evidence, signature, created_at, updated_at
         FROM evidence_objects
        WHERE object_key = $1`,
      [objectKey]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      objectKey: row.object_key,
      evidence: row.evidence,
      signature: row.signature,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * object_key の存在確認。
   *
   * @param {string} objectKey
   * @returns {Promise<boolean>}
   */
  async exists(objectKey) {
    assertValidObjectKey(objectKey);

    const result = await this._pool.query(
      `SELECT 1 FROM evidence_objects WHERE object_key = $1 LIMIT 1`,
      [objectKey]
    );
    return result.rows.length > 0;
  }

  /**
   * object_key に一致する Evidence を削除する。
   *
   * @param {string} objectKey
   * @returns {Promise<boolean>} 削除できた場合 true、対象なしの場合 false
   */
  async delete(objectKey) {
    assertValidObjectKey(objectKey);

    const result = await this._pool.query(
      `DELETE FROM evidence_objects WHERE object_key = $1`,
      [objectKey]
    );
    return result.rowCount > 0;
  }

  /**
   * object_key プレフィックスで一覧取得する。
   * 件数が多い場合は limit で絞ること。
   *
   * @param {string} prefix - 前方一致プレフィックス（例: "consent/"）
   * @param {number} [limit=100]
   * @returns {Promise<Array<{objectKey:string, createdAt:Date, updatedAt:Date}>>}
   */
  async list(prefix, limit = 100) {
    if (typeof prefix !== "string") {
      throw new Error("PgEvidenceStore.list: `prefix` must be a string.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
      throw new Error("PgEvidenceStore.list: `limit` must be an integer between 1 and 10000.");
    }

    const result = await this._pool.query(
      `SELECT object_key, created_at, updated_at
         FROM evidence_objects
        WHERE object_key LIKE $1
        ORDER BY object_key ASC
        LIMIT $2`,
      [`${prefix}%`, limit]
    );

    return result.rows.map((row) => ({
      objectKey: row.object_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

/**
 * object_key のバリデーション。
 * スラッシュで区切られたパス形式を想定。空文字・非文字列は拒否。
 *
 * @param {string} key
 */
function assertValidObjectKey(key) {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("PgEvidenceStore: objectKey must be a non-empty string.");
  }
  // ヌルバイトや改行など制御文字を含むキーは拒否（SQLインジェクション防止の追加バリア）
  // ヌルバイト（\x00）や改行・タブ等の制御文字（\x01-\x1f）を含むキーは拒否する。
  // これはパラメータバインドによるSQLインジェクション防止に加えた多層防御であり、
  // DBログや監査ログにおいて制御文字が意図せずエスケープ・改行されることで
  // ログ偽装（log injection）が生じるリスクを排除するためのセキュリティチェック。
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(key)) {
    throw new Error(
      "PgEvidenceStore: objectKey must not contain control characters."
    );
  }
}

module.exports = { PgEvidenceStore, assertValidObjectKey };
