'use strict';

/**
 * canonicalize@3.0.0 は type:"module" の純ESMパッケージのため、
 * CommonJS環境からは動的 import() でのみロード可能。
 * audit.js / metadata-signing.js / signature-digest.js で
 * 個別に実装されていたロード処理をここに一元化する。
 *
 * キャッシュ理由: import() は毎回Promiseを生成するため、
 * モジュールスコープでPromiseをキャッシュして再ロードを防ぐ。
 */

let canonicalizeFunctionPromise;

function loadCanonicalizeFunction() {
  if (!canonicalizeFunctionPromise) {
    canonicalizeFunctionPromise = import('canonicalize').then((module) => {
      const canonicalize = module.default || module;

      if (typeof canonicalize !== 'function') {
        throw new Error('Failed to load canonicalize function');
      }

      return canonicalize;
    });
  }

  return canonicalizeFunctionPromise;
}

/**
 * 任意の値をRFC 8785 (JCS) 準拠のcanonical JSON文字列に変換する。
 * @param {*} value
 * @returns {Promise<string>}
 */
async function canonicalizeValue(value) {
  const canonicalize = await loadCanonicalizeFunction();
  const canonicalJson = canonicalize(value);

  if (typeof canonicalJson !== 'string') {
    throw new Error('Failed to canonicalize value using RFC 8785 JCS');
  }

  return canonicalJson;
}

module.exports = {
  loadCanonicalizeFunction,
  canonicalizeValue,
};