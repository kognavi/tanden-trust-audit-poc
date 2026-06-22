# AWS KMS Key Management Design

## 1. Purpose

This document describes a production-oriented key management design for the Tanden Trust Audit PoC.

The current PoC uses a local ECDSA P-256 key pair to sign and verify canonical evidence data. This is useful for demonstration and local development, but it is not suitable for production environments because private keys should not be stored or managed as local files.

The purpose of this design is to define how the current local signing workflow can be migrated to an AWS-based key management architecture using AWS Key Management Service, also known as AWS KMS.

The target goals are:

- Replace local private key handling with AWS KMS asymmetric keys
- Prevent direct access to private key material
- Restrict signing permissions using IAM least privilege
- Record key usage through AWS CloudTrail
- Store evidence and signature metadata in a verifiable format
- Prepare for future integration with immutable storage and blockchain anchoring

This document focuses on architecture and design. It does not implement the AWS KMS signing provider yet.

---

## 2. Current Local Signing Workflow

The current PoC signs evidence data using a locally generated ECDSA P-256 key pair.

The simplified workflow is:

```text
Evidence JSON
  ↓
Canonicalization
  ↓
SHA-256 digest
  ↓
Local ECDSA P-256 private key signing
  ↓
Signature file
  ↓
Public key verification
  ↓
VALID / INVALID
```

The current local signing flow is useful because it demonstrates the core cryptographic model:

- Evidence data is canonicalized before hashing
- A SHA-256 digest is generated from the canonical evidence
- The digest is signed with an ECDSA P-256 private key
- The signature is verified with the corresponding public key
- Tampering with the evidence causes signature verification to fail

However, this local model has important limitations.

### Current limitations

- The private key may exist as a local file
- Key access cannot be centrally controlled
- Key usage is not automatically audited
- Key rotation is manual
- Production-grade separation of duties is difficult
- The signing operation depends on local machine security
- It is not suitable for regulated or audit-sensitive workflows

For production use, the private key should be protected by a managed key service.

---

## 3. Production Requirements

A production-ready signing architecture should satisfy the following requirements.

### 3.1 Private key protection

Private key material must not be exposed to application code, local files, CI logs, or developers.

The application should request a signing operation from a managed key service, but it should not be able to export or directly read the private key.

### 3.2 Strong identity and access control

Only authorized workloads should be allowed to sign evidence.

Signing permissions should be controlled using IAM policies and should follow the principle of least privilege.

### 3.3 Auditability

All signing operations should be recorded.

A production system should be able to answer:

- Who requested the signing operation?
- Which key was used?
- When was the key used?
- From which AWS principal or workload was the request made?
- Was the operation successful or denied?

### 3.4 Verifiability

The verification process should not depend on the signer’s internal environment.

A third party should be able to verify:

- The evidence hash
- The signature
- The signing algorithm
- The public key
- The key identifier
- The timestamp and metadata associated with the signature

### 3.5 Evidence immutability

Evidence records and signature metadata should be stored in a way that prevents accidental or malicious modification.

S3 Object Lock can be used as a future storage layer for write-once-read-many style evidence preservation.

### 3.6 Future blockchain anchoring

The system should be designed so that evidence hashes or signature metadata can later be anchored to a blockchain.

The full evidence content should remain off-chain, while only compact verification data should be anchored externally.

---

## 4. Proposed AWS KMS Asymmetric Signing Design

AWS KMS supports asymmetric keys that can be used for signing and verification.

For this PoC, the local ECDSA P-256 key pair can be replaced with an AWS KMS asymmetric signing key.

Recommended key type:

```text
Key spec: ECC_NIST_P256
Key usage: SIGN_VERIFY
Signing algorithm: ECDSA_SHA_256
```

This corresponds conceptually to the current local ECDSA P-256 signing model.

### 4.1 High-level architecture

```text
Evidence JSON
  ↓
Canonicalization
  ↓
SHA-256 digest
  ↓
AWS KMS Sign API
  ↓
Signature metadata
  ↓
Evidence + Signature + Public key reference
  ↓
Verification
  ↓
VALID / INVALID
```

### 4.2 AWS services

The proposed architecture uses the following AWS services:

| Service | Role |
| --- | --- |
| AWS KMS | Protects asymmetric signing key and performs signing operations |
| IAM | Controls which principals can sign or verify |
| CloudTrail | Records KMS API usage for audit |
| Amazon S3 | Stores evidence, signatures, and metadata |
| S3 Object Lock | Provides immutable retention for evidence records |
| Amazon DynamoDB | Optional metadata index for evidence records |
| Amazon EventBridge | Optional event-driven processing |
| AWS Lambda | Optional signing or verification execution environment |

---

## 5. Signing Workflow with AWS KMS

The production signing workflow should be:

```text
1. Load evidence JSON
2. Canonicalize evidence
3. Generate SHA-256 digest
4. Call AWS KMS Sign API with the digest
5. Store the returned signature
6. Store signature metadata
7. Optionally store evidence and metadata in immutable storage
```

### 5.1 Digest generation

The application should canonicalize the evidence JSON before hashing.

This prevents semantically equivalent JSON documents with different key orders from producing different hashes.

The digest should be generated using SHA-256.

```text
canonical evidence -> SHA-256 digest -> KMS Sign
```

### 5.2 KMS Sign API

The application should call AWS KMS Sign with:

```text
KeyId: KMS asymmetric key ID or ARN
Message: SHA-256 digest
MessageType: DIGEST
SigningAlgorithm: ECDSA_SHA_256
```

Using `MessageType: DIGEST` makes it explicit that the application is passing a precomputed digest to KMS.

### 5.3 Signature output

AWS KMS returns a digital signature.

The system should store the signature together with metadata such as:

```json
{
  "evidenceId": "sample-evidence-001",
  "digestAlgorithm": "SHA-256",
  "signingAlgorithm": "ECDSA_SHA_256",
  "keySpec": "ECC_NIST_P256",
  "kmsKeyId": "arn:aws:kms:ap-northeast-1:123456789012:key/example-key-id",
  "signatureEncoding": "DER",
  "signedAt": "2026-06-22T00:00:00Z"
}
```

The exact metadata format may evolve as the PoC matures.

---

## 6. Verification Workflow

Verification can be performed in two ways.

### 6.1 Verification using AWS KMS Verify API

AWS KMS provides a Verify API for asymmetric keys.

The verification workflow is:

```text
Evidence JSON
  ↓
Canonicalization
  ↓
SHA-256 digest
  ↓
KMS Verify API
  ↓
VALID / INVALID
```

The application calls AWS KMS Verify with:

```text
KeyId: KMS asymmetric key ID or ARN
Message: SHA-256 digest
MessageType: DIGEST
Signature: stored signature
SigningAlgorithm: ECDSA_SHA_256
```

This is useful when verification is performed inside the same AWS environment.

### 6.2 Offline verification using public key

For external verification, the public key can be exported using AWS KMS GetPublicKey.

Important point:

- AWS KMS asymmetric private keys cannot be exported
- Public keys can be retrieved and shared for verification

The offline verification workflow is:

```text
Evidence JSON
  ↓
Canonicalization
  ↓
SHA-256 digest
  ↓
Public key verification
  ↓
VALID / INVALID
```

This model is useful when third parties need to verify evidence without direct AWS account access.

---

## 7. IAM Least Privilege Design

IAM policies should separate signing, verification, and key administration responsibilities.

### 7.1 Signing role

The signing role should only be allowed to call the required KMS signing actions for a specific key.

Example policy concept:

```json
{
  "Effect": "Allow",
  "Action": [
    "kms:Sign",
    "kms:GetPublicKey"
  ],
  "Resource": "arn:aws:kms:ap-northeast-1:123456789012:key/example-key-id"
}
```

The signing role should not be allowed to:

- Schedule key deletion
- Disable the key
- Modify the key policy
- Create grants unless explicitly required
- Use unrelated KMS keys

### 7.2 Verification role

The verification role may only need:

```json
{
  "Effect": "Allow",
  "Action": [
    "kms:Verify",
    "kms:GetPublicKey"
  ],
  "Resource": "arn:aws:kms:ap-northeast-1:123456789012:key/example-key-id"
}
```

If verification is performed offline using a stored public key, the verifier may not need AWS KMS permissions at all.

### 7.3 Key administrator role

The key administrator role should manage the lifecycle of the KMS key.

Administrative permissions should be separated from signing permissions.

The key administrator may be allowed to:

- Create keys
- Enable or disable keys
- Rotate aliases
- Manage key policies
- Schedule key deletion

The key administrator should not automatically have application signing privileges unless explicitly required.

---

## 8. CloudTrail Audit Logging

AWS CloudTrail should be enabled to record KMS API usage.

The following KMS events are especially important:

- `Sign`
- `Verify`
- `GetPublicKey`
- `CreateKey`
- `DisableKey`
- `ScheduleKeyDeletion`
- `PutKeyPolicy`
- `CreateAlias`
- `UpdateAlias`

CloudTrail helps answer audit questions such as:

- Which IAM principal requested signing?
- Which KMS key was used?
- When did the operation occur?
- Was the operation allowed or denied?
- Which source IP or AWS service invoked the request?

### 8.1 Audit trail design

A future production system should store or query CloudTrail logs to correlate:

```text
Evidence ID
  ↓
Signature metadata
  ↓
KMS key ID
  ↓
CloudTrail Sign event
  ↓
IAM principal
  ↓
Timestamp
```

This enables stronger auditability than local key signing.

---

## 9. Evidence Storage with S3 Object Lock

The signed evidence and metadata should be stored in a durable storage layer.

Amazon S3 can be used for evidence storage. S3 Object Lock can be used to prevent objects from being modified or deleted for a defined retention period.

### 9.1 Suggested storage layout

```text
s3://tanden-trust-audit-evidence/
  evidence/
    sample-evidence-001.json
  signatures/
    sample-evidence-001.signature.der
  metadata/
    sample-evidence-001.signature-metadata.json
  public-keys/
    kms-key-example-public-key.pem
```

### 9.2 Object Lock modes

S3 Object Lock supports:

- Governance mode
- Compliance mode

For early production or controlled environments, governance mode may be easier to operate.

For strict regulatory preservation, compliance mode may be appropriate, but it must be used carefully because protected objects cannot be overwritten or deleted until the retention period expires.

### 9.3 Storage requirements

Evidence storage should preserve:

- Original evidence JSON
- Canonicalization rules or version
- Evidence digest
- Signature
- Signature metadata
- Public key reference
- KMS key ID
- Signing timestamp
- Verification result records, if needed

---

## 10. Signature Metadata Design

A signature alone is not enough for long-term verification.

The system should store enough metadata to reconstruct the verification process.

Example metadata:

```json
{
  "evidenceId": "sample-evidence-001",
  "evidencePath": "evidence/sample-evidence-001.json",
  "canonicalization": {
    "method": "JCS-like stable JSON canonicalization",
    "version": "0.1.0"
  },
  "digest": {
    "algorithm": "SHA-256",
    "encoding": "hex",
    "value": "example-digest-value"
  },
  "signature": {
    "algorithm": "ECDSA_SHA_256",
    "keySpec": "ECC_NIST_P256",
    "encoding": "DER",
    "path": "signatures/sample-evidence-001.signature.der"
  },
  "kms": {
    "keyId": "arn:aws:kms:ap-northeast-1:123456789012:key/example-key-id",
    "keyAlias": "alias/tanden-trust-audit-signing",
    "messageType": "DIGEST"
  },
  "signedAt": "2026-06-22T00:00:00Z"
}
```

This metadata
