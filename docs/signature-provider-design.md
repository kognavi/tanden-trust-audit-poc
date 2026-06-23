# Signature Provider Design

## Overview

This document describes the signature provider design used in **Tanden Trust Audit PoC**.

The goal of this design is to separate the evidence digest generation layer from the cryptographic signature provider layer, while preserving the existing public API used by scripts and tests.

This makes the current local ECDSA signing implementation easier to test and prepares the project for a future AWS KMS-backed signing provider.

---

## Design Goals

The signature provider design has the following goals:

1. **Keep evidence canonicalization and digest generation provider-independent**
2. **Encapsulate local ECDSA signing logic in a dedicated provider**
3. **Preserve backward compatibility through `lib/signature.js`**
4. **Prepare for a future AWS KMS-backed provider**
5. **Make signing and verification behavior easier to test directly**

---

## Current File Structure

```text
lib/
├── signature.js
├── signature-digest.js
└── local-ecdsa-provider.js
```

---

## Component Responsibilities

### `lib/signature-digest.js`

This module is responsible for evidence canonicalization and digest generation.

It should not depend on any specific signing backend.

Responsibilities:

- Canonicalize evidence objects into deterministic JSON
- Generate SHA-256 digest values
- Provide reusable digest utilities for multiple signature providers

### `lib/local-ecdsa-provider.js`

This module encapsulates local ECDSA signing and verification behavior.

Responsibilities:

- Sign evidence digests using a local private key
- Verify signatures using a local public key
- Keep local cryptographic implementation details outside the public facade

### `lib/signature.js`

This module acts as the public facade for signing and verification.

Responsibilities:

- Preserve the existing public API used by scripts and tests
- Delegate local signing and verification to `LocalEcdsaProvider`
- Hide provider implementation details from callers

---

## Design Rationale

Before this refactoring, evidence digest generation and local ECDSA signing behavior were tightly coupled.

This made the implementation simple, but it also made future provider expansion harder.

By introducing a provider-oriented structure, the project can support multiple signing backends without changing the public API.

For example, a future AWS KMS-backed provider can be introduced as a separate implementation while reusing the same digest generation logic.

---

## Future Extension: AWS KMS Provider

A future `AwsKmsProvider` may be added with the following responsibilities:

- Use AWS KMS asymmetric keys for signing
- Send evidence digest values to KMS Sign API
- Verify signatures locally or through KMS-compatible verification logic
- Avoid exporting private key material from AWS KMS
- Improve production readiness by delegating key protection to managed infrastructure

Expected future file structure:

```text
lib/
├── signature.js
├── signature-digest.js
├── local-ecdsa-provider.js
└── aws-kms-provider.js
```

---

## Backward Compatibility

The existing `lib/signature.js` module continues to expose the public signing and verification functions used by the current scripts and tests.

This allows internal implementation details to evolve without forcing callers to change.

---

## Testing Strategy

The provider structure makes it possible to test each responsibility independently.

Recommended test targets:

- Digest generation consistency
- Local ECDSA signing behavior
- Local ECDSA verification behavior
- Tamper detection behavior
- Public facade compatibility

---

## Summary

This design separates deterministic evidence digest generation from provider-specific cryptographic signing logic.

The result is a cleaner and more extensible architecture that supports the current local ECDSA implementation while preparing the project for AWS KMS-backed production signing.
