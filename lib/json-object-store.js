"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function createStoreError(message, code, cause) {
  const error = new Error(message);
  error.code = code;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function assertValidObjectKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    throw createStoreError("Object key must be a non-empty string", "INVALID_OBJECT_KEY");
  }

  if (path.isAbsolute(key)) {
    throw createStoreError("Object key must be a relative path", "INVALID_OBJECT_KEY");
  }

  const normalized = path.posix.normalize(key);

  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw createStoreError("Object key must not escape the store base directory", "INVALID_OBJECT_KEY");
  }

  if (normalized.includes("\\") || key.includes("\0")) {
    throw createStoreError("Object key contains invalid characters", "INVALID_OBJECT_KEY");
  }

  return normalized;
}

class LocalJsonObjectStore {
  constructor({ baseDir } = {}) {
    if (typeof baseDir !== "string" || baseDir.length === 0) {
      throw createStoreError("baseDir must be a non-empty string", "INVALID_BASE_DIR");
    }

    this.baseDir = path.resolve(baseDir);
  }

  resolveObjectPath(key) {
    const normalizedKey = assertValidObjectKey(key);
    const objectPath = path.resolve(this.baseDir, normalizedKey);

    if (!objectPath.startsWith(this.baseDir + path.sep) && objectPath !== this.baseDir) {
      throw createStoreError("Object key must not escape the store base directory", "INVALID_OBJECT_KEY");
    }

    return objectPath;
  }

  async putJsonObject(key, value) {
    const objectPath = this.resolveObjectPath(key);
    const body = JSON.stringify(value, null, 2) + "\n";

    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    await fs.writeFile(objectPath, body, "utf8");

    return {
      key: assertValidObjectKey(key),
      path: objectPath,
      contentType: "application/json",
      bytesWritten: Buffer.byteLength(body, "utf8"),
    };
  }

  async getJsonObject(key) {
    const objectPath = this.resolveObjectPath(key);

    let raw;
    try {
      raw = await fs.readFile(objectPath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw createStoreError(`Object not found: ${key}`, "OBJECT_NOT_FOUND", error);
      }

      throw error;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw createStoreError(`Object is not valid JSON: ${key}`, "INVALID_JSON_OBJECT", error);
    }
  }
}

module.exports = {
  LocalJsonObjectStore,
  assertValidObjectKey,
};
