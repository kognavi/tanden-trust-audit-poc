"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const {
  S3JsonObjectStore,
  assertValidBucket,
  streamToString,
  isNotFoundError,
} = require("../lib/s3-json-object-store");

class FakeS3Client {
  constructor(handler) {
    this.handler = handler;
    this.commands = [];
  }

  async send(command) {
    this.commands.push(command);
    return this.handler(command);
  }
}

test("assertValidBucket accepts non-empty bucket", () => {
  assert.equal(assertValidBucket("test-bucket"), "test-bucket");
});

test("assertValidBucket rejects empty bucket", () => {
  assert.throws(
    () => assertValidBucket(""),
    (error) => {
      assert.equal(error.code, "INVALID_BUCKET");
      return true;
    }
  );
});

test("streamToString accepts string body", async () => {
  assert.equal(await streamToString("hello"), "hello");
});

test("streamToString accepts Buffer body", async () => {
  assert.equal(await streamToString(Buffer.from("hello")), "hello");
});

test("streamToString accepts Uint8Array body", async () => {
  assert.equal(await streamToString(new Uint8Array(Buffer.from("hello"))), "hello");
});

test("streamToString accepts async iterable stream body", async () => {
  const stream = Readable.from(["hello", " ", "world"]);
  assert.equal(await streamToString(stream), "hello world");
});

test("isNotFoundError detects S3 not found variants", () => {
  assert.equal(isNotFoundError({ name: "NoSuchKey" }), true);
  assert.equal(isNotFoundError({ Code: "NoSuchKey" }), true);
  assert.equal(isNotFoundError({ code: "NotFound" }), true);
  assert.equal(isNotFoundError({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isNotFoundError({ name: "AccessDenied" }), false);
});

test("S3JsonObjectStore putJsonObject sends PutObjectCommand", async () => {
  const client = new FakeS3Client(async () => ({}));
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  const result = await store.putJsonObject("evidence/evidence-001.json", {
    ok: true,
  });

  assert.equal(result.bucket, "test-bucket");
  assert.equal(result.key, "evidence/evidence-001.json");
  assert.equal(result.contentType, "application/json");
  assert.ok(result.bytesWritten > 0);

  assert.equal(client.commands.length, 1);
  assert.equal(client.commands[0].constructor.name, "PutObjectCommand");
  assert.deepEqual(client.commands[0].input, {
    Bucket: "test-bucket",
    Key: "evidence/evidence-001.json",
    Body: JSON.stringify({ ok: true }, null, 2) + "\n",
    ContentType: "application/json",
    IfNoneMatch: "*",
  });
});

test("S3JsonObjectStore getJsonObject sends GetObjectCommand and parses JSON", async () => {
  const client = new FakeS3Client(async () => ({
    Body: Readable.from([JSON.stringify({ ok: true })]),
  }));

  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  const result = await store.getJsonObject("evidence/evidence-001.json");

  assert.deepEqual(result, { ok: true });
  assert.equal(client.commands.length, 1);
  assert.equal(client.commands[0].constructor.name, "GetObjectCommand");
  assert.deepEqual(client.commands[0].input, {
    Bucket: "test-bucket",
    Key: "evidence/evidence-001.json",
  });
});


test("S3JsonObjectStore rejects unsafe key on put", async () => {
  const client = new FakeS3Client(async () => ({}));
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  await assert.rejects(
    async () => store.putJsonObject("../escape.json", { ok: true }),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("S3JsonObjectStore rejects unsafe key on get", async () => {
  const client = new FakeS3Client(async () => ({}));
  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  await assert.rejects(
    async () => store.getJsonObject("../escape.json"),
    (error) => {
      assert.equal(error.code, "INVALID_OBJECT_KEY");
      return true;
    }
  );
});

test("S3JsonObjectStore maps NoSuchKey to OBJECT_NOT_FOUND", async () => {
  const client = new FakeS3Client(async () => {
    const error = new Error("not found");
    error.name = "NoSuchKey";
    throw error;
  });

  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  await assert.rejects(
    async () => store.getJsonObject("missing/object.json"),
    (error) => {
      assert.equal(error.code, "OBJECT_NOT_FOUND");
      return true;
    }
  );
});

test("S3JsonObjectStore maps invalid JSON to INVALID_JSON_OBJECT", async () => {
  const client = new FakeS3Client(async () => ({
    Body: Readable.from(["{ invalid json"]),
  }));

  const store = new S3JsonObjectStore({
    bucket: "test-bucket",
    client,
  });

  await assert.rejects(
    async () => store.getJsonObject("broken.json"),
    (error) => {
      assert.equal(error.code, "INVALID_JSON_OBJECT");
      return true;
    }
  );
});

test("putJsonObject sends IfNoneMatch to enforce WORM semantics on write", async () => {
  let capturedInput;
  const fakeClient = {
    send: async (command) => {
      capturedInput = command.input;
      return {};
    },
  };

  const store = new S3JsonObjectStore({ bucket: "test-bucket", client: fakeClient });
  await store.putJsonObject("evidence/sample.json", { hello: "world" });

  assert.equal(capturedInput.IfNoneMatch, "*");
});

test("putJsonObject converts PreconditionFailed (412) into OBJECT_ALREADY_EXISTS", async () => {
  const fakeClient = {
    send: async () => {
      const err = new Error("At least one of the pre-conditions you specified did not hold");
      err.name = "PreconditionFailed";
      err.$metadata = { httpStatusCode: 412 };
      throw err;
    },
  };

  const store = new S3JsonObjectStore({ bucket: "test-bucket", client: fakeClient });

  await assert.rejects(
    () => store.putJsonObject("evidence/sample.json", { hello: "world" }),
    (err) => {
      assert.equal(err.code, "OBJECT_ALREADY_EXISTS");
      assert.match(err.message, /cannot be overwritten/);
      return true;
    }
  );
});

test("putJsonObject rethrows non-precondition errors unchanged", async () => {
  const fakeClient = {
    send: async () => {
      throw new Error("Some unrelated network error");
    },
  };

  const store = new S3JsonObjectStore({ bucket: "test-bucket", client: fakeClient });

  await assert.rejects(
    () => store.putJsonObject("evidence/sample.json", { hello: "world" }),
    /Some unrelated network error/
  );
});
