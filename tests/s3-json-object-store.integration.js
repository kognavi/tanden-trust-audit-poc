"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const {
  S3Client,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { S3JsonObjectStore } = require("../lib/s3-json-object-store");

const shouldRunAwsIntegrationTests =
  process.env.RUN_AWS_INTEGRATION_TESTS === "1" &&
  Boolean(process.env.AWS_S3_INTEGRATION_BUCKET);

const bucket = process.env.AWS_S3_INTEGRATION_BUCKET;
const region = process.env.AWS_REGION || "ap-northeast-1";

const skipReason =
  "Set RUN_AWS_INTEGRATION_TESTS=1 and AWS_S3_INTEGRATION_BUCKET to run real AWS S3 integration tests.";

test(
  "AWS S3 integration: S3JsonObjectStore writes and reads JSON object",
  { skip: shouldRunAwsIntegrationTests ? false : skipReason },
  async () => {
    const client = new S3Client({ region });
    const store = new S3JsonObjectStore({
      bucket,
      client,
    });

    const key = `integration-tests/s3-json-object-store/${randomUUID()}.json`;

    const value = {
      schemaVersion: "aws-s3-integration-test/v1",
      id: randomUUID(),
      message: "hello from real AWS S3 integration test",
      createdAt: new Date().toISOString(),
      storage: {
        provider: "aws-s3",
        bucket,
        region,
        key,
      },
    };

    let objectWritten = false;

    try {
      const putResult = await store.putJsonObject(key, value);
      objectWritten = true;

      assert.equal(putResult.bucket, bucket);
      assert.equal(putResult.key, key);
      assert.equal(putResult.contentType, "application/json");
      assert.ok(putResult.bytesWritten > 0);

      const loaded = await store.getJsonObject(key);

      assert.deepEqual(loaded, value);
    } finally {
      if (objectWritten) {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      }
    }
  }
);
