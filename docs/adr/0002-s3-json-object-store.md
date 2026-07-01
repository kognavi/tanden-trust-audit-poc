# ADR 0002: Use S3JsonObjectStore for evidence and sidecar metadata storage

## Status

Accepted

## Context

The project stores trust evidence and sidecar metadata as JSON objects.

Phase 2 introduced schema validation, canonical metadata signing payloads, sidecar metadata signatures, evidence + metadata verification, local JSON object storage, and local sidecar E2E tests.

The next production-oriented storage backend is Amazon S3.

However, normal tests should not depend on real AWS credentials, buckets, regions, IAM permissions, network availability, or AWS service behavior.

The storage layer must also not become the trust boundary. Even when evidence and metadata are loaded from S3, integrity and authenticity must still be verified cryptographically.

## Decision

Introduce `S3JsonObjectStore` as a pluggable JSON object storage backend.

It uses the same minimal interface as `LocalJsonObjectStore`:

```js
await store.putJsonObject(key, value);
const object = await store.getJsonObject(key);
```

`S3JsonObjectStore` uses AWS SDK for JavaScript v3:

- `S3Client`
- `PutObjectCommand`
- `GetObjectCommand`

The class accepts an injected S3 client:

```js
new S3JsonObjectStore({
  bucket: "example-bucket",
  client,
});
```

When no client is supplied, it creates a real AWS SDK S3 client:

```js
new S3JsonObjectStore({
  bucket: "example-bucket",
  region: "ap-northeast-1",
});
```

This allows unit tests and E2E-style tests to use fake or in-memory clients while production code can use real S3.

The implementation normalizes common errors:

- invalid bucket: `INVALID_BUCKET`
- invalid object key: `INVALID_OBJECT_KEY`
- missing S3 object: `OBJECT_NOT_FOUND`
- invalid JSON body: `INVALID_JSON_OBJECT`

The S3 sidecar E2E test uses an in-memory fake S3 client to verify:

1. evidence storage
2. sidecar metadata storage
3. evidence loading
4. metadata loading
5. evidence digest verification
6. metadata signature verification
7. tampered evidence detection
8. tampered metadata detection
9. missing metadata handling

## Consequences

### Positive

- Storage backends are pluggable.
- Local and S3 storage share the same high-level interface.
- Tests can run without AWS credentials.
- The default test suite remains fast and deterministic.
- Production S3 usage is still supported.
- S3 is treated as storage, not as a cryptographic trust boundary.
- Evidence integrity is verified after loading.
- Metadata authenticity is verified after loading.

### Negative

- The default test suite does not exercise real AWS S3.
- Fake S3 behavior may not match every AWS edge case.
- Production hardening options are not yet implemented.

## Future Work

Future production hardening may include:

- S3 bucket versioning
- S3 Object Lock
- SSE-S3 or SSE-KMS encryption
- KMS key configuration
- object metadata
- conditional writes
- real AWS integration tests gated by environment variables
- IAM least-privilege examples
- lifecycle and retention policy documentation

For audit-grade storage, S3 versioning and Object Lock should be considered at the bucket level.

## Related Implementation

- `lib/s3-json-object-store.js`
- `tests/s3-json-object-store.test.js`
- `tests/s3-sidecar-e2e.test.js`
- `lib/json-object-store.js`
- `tests/local-sidecar-e2e.test.js`
