# Verification Runbook

## Purpose

This runbook describes how to verify evidence in the Tanden Trust Audit PoC.

It is intended for reviewers, auditors, developers, and operators who want to reproduce the local evidence validation and tamper-evident verification workflow.

The current project is a local MVP. Production-oriented controls such as AWS KMS signing, S3 Object Lock, DynamoDB metadata storage, and CloudTrail audit logging are described in separate design documents.

## Scope

This runbook covers:

- preparing the local environment
- installing dependencies
- running automated tests
- validating evidence against JSON Schema
- generating a SHA-256 hash
- verifying evidence against an expected hash
- understanding expected outputs
- running negative verification checks
- troubleshooting common issues
- reviewer checklist

## Related Documents

This runbook complements:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`
- `docs/evidence-lifecycle.md`
- `docs/threat-model.md`
- `docs/aws-reference-architecture.md`
- `docs/kms-signing-design.md`
- `docs/attack-scenarios.md`
- `docs/portfolio-summary.md`

## Prerequisites

Before running verification, ensure the following are available:

- Git
- Node.js 20 or later
- npm
- local clone of this repository
- terminal access
- read access to the evidence file
- read access to the schema file

Optional:

- VS Code or another editor
- GitHub account for reviewing pull requests
- AWS knowledge for reviewing production design documents

## Repository Location

Move to the project directory.

Example:

```bash
cd ~/Documents/tanden-trust-audit-poc
```

Confirm the current directory:

```bash
pwd
```

Expected example:

```text
/Users/kamaikenichirou/Documents/tanden-trust-audit-poc
```

## Confirm Git Status

Before verification, confirm that the working tree is clean.

```bash
git status
```

Expected result:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

If you are reviewing a pull request branch, the branch name may be different. The important point is to understand which branch is being verified.

## Update Main Branch

To verify the latest main branch:

```bash
git switch main
git pull --ff-only origin main
```

Expected result may be:

```text
Already up to date.
```

or a fast-forward update.

## Install Dependencies

Install Node.js dependencies:

```bash
npm ci
```

Use `npm ci` instead of `npm install` for reproducible dependency installation based on the lockfile.

## Evidence File

The sample evidence file is:

```text
samples/evidence-consent.json
```

This file represents synthetic demonstration evidence.

It includes fields such as:

- evidenceId
- schemaVersion
- eventType
- occurredAt
- sourceSystem
- actorId
- subjectId
- purpose
- consent
- metadata
- hashAlgorithm

## Schema File

The JSON Schema file is:

```text
schemas/evidence.schema.json
```

The schema defines the expected structure of evidence records.

It validates requirements such as:

- required fields
- field types
- date-time format
- allowed enum values
- rejection of additional unexpected properties

## Verification Overview

The local verification workflow is:

```text
Evidence JSON
  ↓
JSON Schema validation
  ↓
RFC 8785 JSON Canonicalization
  ↓
SHA-256 hash generation
  ↓
Expected hash comparison
  ↓
VALID or INVALID result
```

## Step 1: Run Automated Tests

Run the test suite:

```bash
npm test
```

Expected result:

```text
tests 14
pass 14
fail 0
```

The tests cover:

- valid untampered evidence
- tampered evidence
- wrong expected hash
- missing evidence file
- repeated hash stability
- canonical JSON key ordering
- equivalent objects with different key order
- array order sensitivity
- valid schema
- missing required fields
- invalid date-time
- additional properties
- invalid consent status

## Step 2: Validate Evidence Against Schema

Run:

```bash
npm run validate:evidence
```

Expected result:

```text
Schema validation result: VALID
```

This confirms that the sample evidence follows the expected JSON Schema.

## Step 3: Generate Evidence Hash

Run:

```bash
npm run hash
```

Expected output includes:

```text
Evidence file: samples/evidence-consent.json
Canonicalization: RFC 8785 JSON Canonicalization Scheme (JCS)
SHA-256 hash: ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

The current expected hash for the sample evidence is stored in:

```text
samples/evidence-consent.expected.sha256
```

The sidecar file uses a `sha256sum`-style format:

```text
ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c  samples/evidence-consent.json
```

In this local MVP, this sidecar file is a local trust assumption. In production, expected digests should be protected by signed metadata, immutable storage, or a trusted registry.

If the sample evidence changes intentionally, this hash will also change.

## Step 4: Verify Evidence Against Expected Hash

Run:

```bash
npm run verify
```

Expected result:

```text
Verification result: VALID
```

This confirms that the recalculated hash matches the expected hash.

## Full Verification Command Set

A typical full local verification run is:

```bash
npm test
npm run validate:evidence
npm run hash
npm run verify
```

Expected high-level results:

```text
tests 14
pass 14
Schema validation result: VALID
Verification result: VALID
```

## Manual Verification Command

The verification script can also be run directly.

Example:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json samples/evidence-consent.expected.sha256
```

Expected result:

```text
Verification result: VALID
```

## Negative Test: Wrong Expected Hash

To confirm that verification detects an incorrect expected hash, run:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json deadbeef
```

Expected result:

```text
Verification result: INVALID
```

This demonstrates that the evidence does not match the provided expected hash.

## Negative Test: Tampered Evidence

To test tampering safely, copy the sample evidence file first.

```bash
cp samples/evidence-consent.json /tmp/evidence-consent-tampered.json
```

Edit the temporary file:

```bash
code /tmp/evidence-consent-tampered.json
```

For example, change:

```json
"status": "granted"
```

to:

```json
"status": "denied"
```

Then run verification using the original expected hash sidecar:

```bash
node scripts/verify-evidence.js /tmp/evidence-consent-tampered.json samples/evidence-consent.expected.sha256
```

Expected result:

```text
Verification result: INVALID
```

This demonstrates tamper-evident behavior.

## Negative Test: Schema Violation

To test schema validation failure, copy the evidence file:

```bash
cp samples/evidence-consent.json /tmp/evidence-consent-invalid-schema.json
```

Edit the temporary file and remove a required field, such as:

```json
"eventType": "CONSENT_GRANTED"
```

Then run validation directly:

```bash
node scripts/validate-evidence.js /tmp/evidence-consent-invalid-schema.json schemas/evidence.schema.json
```

Expected result:

```text
Schema validation result: INVALID
```

The exact error details may vary depending on the validation library output.

## What VALID Means

A `VALID` verification result means:

- the evidence file was read successfully
- the evidence was canonicalized deterministically
- the SHA-256 digest was recalculated
- the recalculated digest matched the expected digest

It does not necessarily mean:

- the original business event truly happened
- the producer was authorized
- the expected hash came from a trusted source
- the evidence was stored immutably
- the signer identity was verified
- the system is compliant with any specific regulation

These concerns are addressed in the broader design documents.

## What INVALID Means

An `INVALID` verification result may mean:

- the evidence content was changed
- the expected hash is wrong
- the wrong evidence file was selected
- the evidence was generated from a different version
- canonicalization or hashing behavior changed
- a copy/paste error occurred when providing the expected hash

Reviewers should investigate before concluding malicious activity.

## Reviewer Checklist

Before accepting evidence as verified, confirm:

- [ ] The repository branch or commit being reviewed is known.
- [ ] Dependencies were installed with `npm ci`.
- [ ] Automated tests passed.
- [ ] Schema validation returned `VALID`.
- [ ] Hash generation completed successfully.
- [ ] Verification returned `VALID`.
- [ ] The expected hash source is documented.
- [ ] The evidence file path is correct.
- [ ] The schema version is appropriate.
- [ ] Any evidence changes are explained in pull requests or change logs.
- [ ] Limitations of hash-only verification are understood.

## Troubleshooting

### Problem: `npm test` fails

Possible causes:

- dependency installation failed
- Node.js version is incompatible
- scripts were modified
- test expectations are outdated
- evidence or schema changed unintentionally

Recommended actions:

```bash
node --version
npm ci
npm test
git status
```

### Problem: Schema validation returns INVALID

Possible causes:

- missing required field
- invalid date-time format
- unsupported enum value
- additional unexpected property
- wrong schema file

Recommended actions:

```bash
node scripts/validate-evidence.js samples/evidence-consent.json schemas/evidence.schema.json
```

Inspect the evidence and schema.

### Problem: Hash changed unexpectedly

Possible causes:

- evidence content changed
- array order changed
- value changed
- field was added or removed
- canonicalization behavior changed

Recommended actions:

```bash
git diff
npm run hash
npm test
```

### Problem: Verification returns INVALID

Possible causes:

- expected hash is incorrect
- evidence was modified
- wrong file path was used
- expected hash was copied incorrectly

Recommended actions:

```bash
npm run hash
npm run verify
git status
```

Compare the generated hash with the expected hash.

### Problem: File not found

Possible causes:

- command executed from the wrong directory
- file path typo
- file was moved or deleted

Recommended actions:

```bash
pwd
ls
ls samples
ls schemas
```

## Production Considerations

In a production AWS environment, this local verification runbook would be extended with:

- AWS KMS signature verification
- S3 Object Lock retention checks
- DynamoDB metadata lookup
- CloudTrail event review
- IAM principal review
- API Gateway request identity review
- Lambda execution log review
- CloudWatch alarm review
- incident response workflow
- key lifecycle review

## Relationship to KMS Signing Design

The local MVP uses hash verification.

Hash verification detects whether content changed, but does not prove who authorized the digest.

The KMS signing design extends this by adding:

- KMS asymmetric signing
- signature metadata
- signer identity
- KMS key ID
- signing algorithm
- CloudTrail logs for signing and verification
- IAM restrictions on `kms:Sign`
- separation of duties between key administration and signing usage

A future production verification runbook should include both hash verification and signature verification.

## Relationship to Attack Scenarios

This runbook supports several attack scenario controls:

| Scenario | Runbook Relevance |
|---|---|
| Evidence tampering | Hash verification should return INVALID. |
| Expected hash substitution | Reviewer must confirm expected hash source. |
| Replay attack | Reviewer should inspect evidenceId and timestamps. |
| Unauthorized producer | Reviewer should confirm producer identity in production. |
| Schema bypass | JSON Schema validation should reject unexpected fields. |
| Timestamp manipulation | Reviewer should compare business time and ingestion time in production. |
| CI/CD compromise | Automated tests and PR review help detect suspicious changes. |
| Dependency compromise | `npm ci`, lockfile review, and tests reduce risk. |

## Evidence Handling Notes

Reviewers should avoid modifying original evidence files during verification.

If negative testing is needed:

- copy evidence to `/tmp`
- modify only the copied file
- do not commit temporary test files
- confirm `git status` before committing

Example:

```bash
git status
```

Expected clean result:

```text
nothing to commit, working tree clean
```

## Recommended Pull Request Verification

For pull requests, reviewers should check:

- files changed
- test results
- documentation consistency
- README links
- evidence schema impact
- hash impact
- security-sensitive code paths
- whether new attack scenarios or controls are needed

Recommended commands:

```bash
npm test
npm run validate:evidence
npm run hash
npm run verify
git diff main...HEAD
```

## Completion Criteria

A local verification run is complete when:

- dependencies are installed successfully
- automated tests pass
- evidence schema validation returns `VALID`
- hash generation succeeds
- evidence verification returns `VALID`
- any negative tests behave as expected
- reviewer notes are recorded if needed

## Limitations

This runbook is for a local prototype.

It does not provide:

- production incident response procedures
- formal audit certification
- legal compliance determination
- cryptographic security review
- AWS operational approval
- complete chain-of-custody validation
- proof that the business event actually occurred

Before production use, this runbook should be expanded and reviewed by qualified security engineers, AWS architects, compliance professionals, auditors, and legal professionals.
