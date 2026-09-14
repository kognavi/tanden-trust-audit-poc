# Signature Provider Design

## Purpose

The Sign layer keeps RFC 8785 canonicalization and digest metadata provider-independent while giving Local ECDSA and AWS KMS the same explicit low-level signing contract.

## Contract

The canonical low-level APIs are:

- `signRawMessage(message, privateKey?)`
- `verifyRawMessageSignature(message, signature, publicKey?)`

`message` is a non-empty `Buffer` containing raw pre-hash bytes. It is not a precomputed digest. Both providers apply SHA-256 exactly once as part of `ECDSA_SHA_256` signing and verification.

The shared contract in `lib/signing-contract.js` fixes:

- hash: `SHA-256`
- signature algorithm: `ECDSA_SHA_256`
- curve: `secp256k1`
- AWS KMS KeySpec: `ECC_SECG_P256K1`
- AWS KMS MessageType: `RAW`
- provider signature bytes: 64-byte IEEE P1363 `r || s`
- AWS KMS API signature bytes: ASN.1 DER

A 32-byte Buffer is not automatically treated as a digest because a valid raw message can also be 32 bytes. This implementation does not infer semantics from length and does not expose a `MessageType: DIGEST` path.

## Components

- `lib/signature-digest.js`: canonicalization and digest metadata.
- `lib/signing-contract.js`: shared constants and fail-closed input/key validators.
- `lib/local-ecdsa-provider.js`: local secp256k1 signing with Node.js crypto.
- `lib/aws-kms-provider.js`: AWS KMS `ECC_SECG_P256K1` signing with DER/P1363 conversion.
- `lib/signature.js`: Local provider facade and compatibility exports.
- `lib/metadata-signature.js`: metadata signing consumer that prefers the canonical API.

## Backward Compatibility

`signDigest` and `verifyDigestSignature` remain deprecated aliases with their existing raw-message behavior. Their meaning is not changed to precomputed-digest signing. First-party consumers use the canonical API; injected legacy providers that only expose the aliases remain supported during migration.

## Validation

- Invalid or empty messages are rejected before cryptographic or KMS operations.
- Verify requires a 64-byte IEEE P1363 Buffer; malformed signatures return `false` without cryptographic or KMS operations.
- Local keys must be EC `secp256k1` keys.
- KMS keys must report `ECC_SECG_P256K1`.
- KMS Sign and Verify both use `RAW` and `ECDSA_SHA_256`.
- Cross-provider tests independently verify the single-SHA-256 contract.

## Boundaries

This design does not change AWS resources, IAM, KMS keys, key policies, deployment, or the repository trust flow `Evidence → Schema → Sign → Store → Ledger`.
