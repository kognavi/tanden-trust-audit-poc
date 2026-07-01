"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  LocalJsonObjectStore,
  assertValidObjectKey,
} = require("../lib/json-object-store");

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "tanden-json-store-"));
}

test("assertValidObjectKey accepts safe relative keys", () => {
  assert.equal(
    assertValidObjectKey("evidence/evidence-001.json"),
    "evidence/evidence-001.json"
  );
});

test("assertValidObjectKey rejects empty key", () => {
  assert.throws(
    () => assertValidObjectKey(""),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("assertValidObjectKey rejects absolute path", () => {
  assert.throws(
    () => assertValidObjectKey("/tmp/evidence.json"),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("assertValidObjectKey rejects path traversal", () => {
  assert.throws(
    () => assertValidObjectKey("../secrets.json"),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("LocalJsonObjectStore requires baseDir", () => {
  assert.throws(
    () => new LocalJsonObjectStore(),
    (error) => {
      assert.equal(error.code, "INVALID_BASE_DIR");
      return true;
    }
  );
});

test("LocalJsonObjectStore writes and reads JSON object", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  const evidence = {
    evidenceId: "evidence-001",
    action: "consent.granted",
    occurredAt: "2026-06-28T10:00:00Z",
  };

  const putResult = await store.putJsonObject(
    "evidence/evidence-001.json",
    evidence
  );

  const loaded = await store.getJsonObject("evidence/evidence-001.json");

  assert.equal(putResult.key, "evidence/evidence-001.json");
  assert.equal(putResult.contentType, "application/json");
  assert.ok(putResult.bytesWritten > 0);
  assert.deepEqual(loaded, evidence);
});

test("LocalJsonObjectStore creates nested directories", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  await store.putJsonObject("a/b/c/object.json", { ok: true });

  const raw = await fs.readFile(path.join(baseDir, "a/b/c/object.json"), "utf8");
  assert.ok(raw.includes('"ok": true'));
});

test("LocalJsonObjectStore rejects unsafe key on put", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  await assert.rejects(
    async () => store.putJsonObject("../escape.json", { ok: true }),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("LocalJsonObjectStore rejects unsafe key on get", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  await assert.rejects(
    async () => store.getJsonObject("../escape.json"),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("LocalJsonObjectStore returns OBJECT_NOT_FOUND for missing object", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  await assert.rejects(
    async () => store.getJsonObject("missing/object.json"),
    (error) => {
      assert.equal(error.code, "OBJECT_NOT_FOUND");
      return true;
    }
  );
});

test("LocalJsonObjectStore returns INVALID_JSON_OBJECT for invalid JSON", async () => {
  const baseDir = await createTempDir();
  const store = new LocalJsonObjectStore({ baseDir });

  const invalidJsonPath = path.join(baseDir, "broken.json");
  await fs.writeFile(invalidJsonPath, "{ invalid json", "utf8");

  await assert.rejects(
    async () => store.getJsonObject("broken.json"),
    (error) => {
      assert.equal(error.code, "INVALID_JSON_OBJECT");
      return true;
    }
  );
});
