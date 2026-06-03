# Local Verification Result

## Overview

This document records the local verification result of the Tanden Trust Audit PoC.

The purpose of this test is to confirm that:

- A structured JSON evidence file can be hashed
- The generated hash can be used to verify integrity
- A small modification to the evidence file changes the hash
- The verification script can detect tampering

## Environment

The verification was performed in the following environment:

```text
OS: macOS
Node.js: v20.20.2
Repository: tanden-trust-audit-poc
```

## Step 1: Generate SHA-256 Hash

Command:

```bash
node scripts/hash-evidence.js samples/evidence-consent.json
```

Output:

```text
Evidence file: samples/evidence-consent.json
Canonical JSON: {"actorId":"actor-demo-001","consent":{"scope":["activity_recording","audit_verification"],"status":"granted","version":"v1.0"},"eventType":"CONSENT_GRANTED","evidenceId":"evd-2026-000001","metadata":{"containsPersonalData":false,"environment":"demo","notes":"This is synthetic sample data for demonstration only."},"occurredAt":"2026-06-02T03:00:00Z","purpose":"Demonstrate tamper-evident consent evidence for a prototype audit trail.","sourceSystem":"tanden-trust-audit-poc","subjectId":"subject-demo-001"}
SHA-256 hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

Generated hash:

```text
98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

## Step 2: Verify Original Evidence

Command:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

Output:

```text
Evidence file: samples/evidence-consent.json
Expected hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
Calculated hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
Verification result: VALID
```

Result:

```text
VALID
```

## Step 3: Modify Evidence

The following field was changed:

Before:

```json
"status": "granted"
```

After:

```json
"status": "revoked"
```

Command:

```bash
perl -pi -e 's/"status": "granted"/"status": "revoked"/' samples/evidence-consent.json
```

## Step 4: Verify Modified Evidence

Command:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

Output:

```text
Evidence file: samples/evidence-consent.json
Expected hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
Calculated hash: 209f5c412879a5cdb1db9e9f939b39eb056afcd62f158c6305b6788429a47158
Verification result: INVALID
```

Result:

```text
INVALID
```

## Step 5: Restore Evidence

Command:

```bash
perl -pi -e 's/"status": "revoked"/"status": "granted"/' samples/evidence-consent.json
```

## Step 6: Verify Restored Evidence

Command:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

Output:

```text
Evidence file: samples/evidence-consent.json
Expected hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
Calculated hash: 98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
Verification result: VALID
```

Result:

```text
VALID
```

## Conclusion

The local verification test confirms that the PoC can detect tampering in structured JSON evidence.

A small change in the evidence data produced a different SHA-256 hash, and the verification script correctly returned `INVALID`.

After restoring the original data, the calculated hash matched the expected hash again, and the verification result returned to `VALID`.

This demonstrates the core integrity verification mechanism of the Tanden Trust Audit PoC.
