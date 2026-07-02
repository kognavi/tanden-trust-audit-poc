# AWS S3 Integration Test

This document describes how to run the real AWS S3 integration test for `S3JsonObjectStore`.

## Purpose

The default test suite uses fake/in-memory S3 clients and does not connect to AWS.

The AWS S3 integration test verifies that `S3JsonObjectStore` can write and read JSON objects against a real S3 bucket using the AWS SDK.

## Test File

```text
tests/s3-json-object-store.integration.js
```

## NPM Script

```bash
npm run test:aws:s3
```

The integration test is intentionally separated from the default test suite:

```bash
npm test
```

This keeps the default test suite deterministic, fast, and independent from real AWS credentials or network availability.

## Required Environment Variables

The real AWS S3 integration test only runs when both of the following are set:

```bash
RUN_AWS_INTEGRATION_TESTS=1
AWS_S3_INTEGRATION_BUCKET=your-bucket-name
```

`AWS_REGION` is optional. If it is not set, the test defaults to:

```bash
ap-northeast-1
```

## Run Without AWS Access

Without the required environment variables, the test is skipped safely:

```bash
npm run test:aws:s3
```

Expected result:

```text
skipped 1
fail 0
```

## Run Against Real AWS S3

Use an existing S3 bucket and credentials available through the standard AWS SDK credential provider chain.

Example:

```bash
RUN_AWS_INTEGRATION_TESTS=1 \
AWS_S3_INTEGRATION_BUCKET=your-bucket-name \
AWS_REGION=ap-northeast-1 \
npm run test:aws:s3
```

Expected result:

```text
pass 1
fail 0
```

## Object Prefix

The test writes temporary objects under the following prefix:

```text
integration-tests/s3-json-object-store/
```

Each test object uses a random UUID-based key.

## Cleanup Behavior

The test deletes the object in a `finally` block after a successful write.

If the write fails before the object is created, no delete request is sent.

If the test process is interrupted, a temporary object may remain under:

```text
integration-tests/s3-json-object-store/
```

Such objects can be safely removed manually.

## Minimum IAM Policy

The test requires only object-level access for the integration test prefix.

Replace `YOUR_BUCKET_NAME` with the target bucket name.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3IntegrationTestObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/integration-tests/s3-json-object-store/*"
    }
  ]
}
```

`ListBucket` is not required because the test does not list objects.

## CI Policy

Do not run this test by default in CI.

Reasons:

- it depends on real AWS credentials
- it depends on network availability
- it can incur AWS cost
- it can fail due to IAM, bucket policy, or regional configuration outside the codebase

If CI execution is required in the future, configure it as a manually triggered or protected workflow with explicit AWS credentials and a dedicated test bucket.

## Verified example

The gated AWS S3 integration test was manually verified against a real S3 bucket.

Environment:

```text
AWS_REGION=ap-northeast-1
RUN_AWS_INTEGRATION_TESTS=1
AWS_S3_INTEGRATION_BUCKET=<redacted-test-bucket>
```

Result:

```text
tests 1
pass 1
fail 0
skipped 0
```

Cleanup check:

```text
No objects remained under integration-tests/s3-json-object-store/.
```

Resource cleanup:

```text
The temporary test bucket was removed after verification.
```

Note:

```text
The verification used SSE-S3 default encryption and public access blocking.
AWS account ID and bucket name are intentionally redacted.
```
