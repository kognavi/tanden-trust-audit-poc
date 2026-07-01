"use strict";

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const { assertValidObjectKey } = require("./json-object-store");

function createS3StoreError(message, code, cause) {
  const error = new Error(message);
  error.code = code;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function assertValidBucket(bucket) {
  if (typeof bucket !== "string" || bucket.length === 0) {
    throw createS3StoreError("bucket must be a non-empty string", "INVALID_BUCKET");
  }

  return bucket;
}

async function streamToString(body) {
  if (body === undefined || body === null) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (typeof body.transformToString === "function") {
    return body.transformToString();
  }

  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  throw createS3StoreError("Unsupported S3 body type", "UNSUPPORTED_S3_BODY");
}

function isNotFoundError(error) {
  if (!error) {
    return false;
  }

  return (
    error.name === "NoSuchKey" ||
    error.name === "NotFound" ||
    error.Code === "NoSuchKey" ||
    error.Code === "NotFound" ||
    error.code === "NoSuchKey" ||
    error.code === "NotFound" ||
    error.$metadata?.httpStatusCode === 404
  );
}

class S3JsonObjectStore {
  constructor({ bucket, region, client } = {}) {
    this.bucket = assertValidBucket(bucket);
    this.client = client || new S3Client({ region });
  }

  async putJsonObject(key, value) {
    const normalizedKey = assertValidObjectKey(key);
    const body = JSON.stringify(value, null, 2) + "\n";

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
        Body: body,
        ContentType: "application/json",
      })
    );

    return {
      bucket: this.bucket,
      key: normalizedKey,
      contentType: "application/json",
      bytesWritten: Buffer.byteLength(body, "utf8"),
    };
  }

  async getJsonObject(key) {
    const normalizedKey = assertValidObjectKey(key);

    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalizedKey,
        })
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        throw createS3StoreError(`Object not found: ${normalizedKey}`, "OBJECT_NOT_FOUND", error);
      }

      throw error;
    }

    const raw = await streamToString(response.Body);

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw createS3StoreError(`Object is not valid JSON: ${normalizedKey}`, "INVALID_JSON_OBJECT", error);
    }
  }
}

module.exports = {
  S3JsonObjectStore,
  assertValidBucket,
  streamToString,
  isNotFoundError,
};
