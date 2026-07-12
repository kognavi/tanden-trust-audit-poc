# ADR 0004: Append-Only Hash-Chain Ledger for Signing Events (PostgreSQL)

## Status
Proposed

## Context
Phase 1–2 of the Tanden Trust Audit PoC established tamper-*detection* for
individual evidence objects via canonical JSON hashing (RFC 8785 JCS +
SHA-256), ECDSA signatures, and S3 sidecar metadata (see ADR 0001–0003).

However, each evidence object is currently verified *in isolation*. There is
no mechanism to detect if an entire signing event were silently deleted, or
if the *order* of events were altered. A hash-chain ledger — where each row
cryptographically references the row before it — extends tamper-evidence
from "is this one object intact?" to "is the entire sequence of events
intact, with nothing missing or reordered?"

This mirrors the design pattern of blockchain block-linking, applied to a
conventional PostgreSQL table for operational simplicity in a PoC context.

## Decision
Implement `lib/pg-signing-logger.js`, backed by a `signing_events` table,
with the following properties:

1. Each row stores `previous_hash` (the `row_hash` of the immediately
   preceding row, or a fixed `GENESIS_HASH` sentinel for the first row).
2. `row_hash` is computed as
   `SHA-256(canonicalize({ eventId, eventType, payload, signature, previousHash }))`
   using the same `canonicalize` (RFC 8785) library already used for
   evidence hashing, ensuring a consistent canonicalization strategy across
   the codebase.
3. **`sequence` (BIGSERIAL) is deliberately excluded from the hash input.**
   PostgreSQL sequences advance outside of transactional rollback — if a
   transaction that reserved a sequence value via `nextval()` is rolled
   back, that value is permanently lost, creating a benign gap. Including
   `sequence` in the cryptographic commitment would make such benign gaps
   indistinguishable from malicious deletion. By chaining purely on
   `previous_hash` → prior row's `row_hash`, the integrity guarantee is
   unaffected by sequence gaps; `sequence` remains purely an ordering
   convenience.
4. Concurrent `appendEvent()` calls are serialized via
   `pg_advisory_xact_lock()` scoped to the ledger, so that `previous_hash`
   always reflects the true last-committed row even under concurrent
   writers (multiple app instances / connections).
5. `UPDATE` and `DELETE` privileges on `signing_events` are revoked from
   `PUBLIC` at schema-creation time, as a defense-in-depth control against
   accidental or unauthorized mutation via the application's own DB role.

## Rationale

- **Why not include `sequence` in the hash?** See point 3 above — this is
  the central design insight of this ADR. The security property we need
  ("nothing was deleted or reordered") is fully satisfied by the
  `previous_hash` chain alone; sequence numbers are a red herring for this
  purpose and introducing them into the hash creates false-positive
  tampering alarms from ordinary rollback behavior.
- **Why an advisory lock instead of `SELECT ... FOR UPDATE`?** There is no
  row to lock before the first insert, and locking the *last* row via
  `FOR UPDATE` still permits a race between two transactions reading
  "the last row" concurrently before either commits. An advisory lock
  scoped to the whole ledger (not a specific row) closes this race
  completely and is simple to reason about for a PoC.
- **Why not a dedicated blockchain / DLT?** Consistent with the PoC's
  stated scope (see `docs/threat-model.md`), a hash-chain over PostgreSQL
  delivers the core tamper-evidence property demonstrated in this
  portfolio without operational overhead of running distributed ledger
  infrastructure — a pragmatic middle ground between "no integrity
  control" and "full blockchain."

## Consequences

**Pros:**
- Detects deletion of any row (breaks the `previous_hash` chain for the
  following row).
- Detects tampering of any field in any row (recomputed `row_hash` will not
  match stored `row_hash`).
- Robust against benign `BIGSERIAL` sequence gaps caused by rolled-back
  transactions.
- `REVOKE UPDATE, DELETE` adds a second layer of defense independent of the
  cryptographic chain.

**Cons / Residual Risks:**
- A sufficiently privileged database role (table owner, superuser) can
  still `GRANT` back `UPDATE`/`DELETE`, `ALTER TABLE`, or edit
  `pg_catalog` directly. The `REVOKE` is a deterrent against the
  application's own credentials, not a guarantee against a malicious DBA —
  this residual risk should be recorded in `docs/threat-model.md`,
  consistent with how ADR 0003 documents S3 Object Lock's residual risks.
- This is *detection*, not *prevention* — a determined attacker with full
  DB access could delete the entire table and recreate a forged chain
  from scratch. Mitigating this requires exporting periodic chain-head
  hashes to an external, independently-controlled anchor (e.g., a signed
  S3 object, or eventually an actual blockchain) — noted as future work.

## Future Recommendations
- Periodically export the latest `row_hash` (the "chain head") to an
  external, append-only store (e.g., S3 with Object Lock — see ADR 0003 —
  once that constraint is revisited) to detect full-table deletion/replacement.
- Consider row-level security (RLS) policies for defense-in-depth beyond
  table-level `REVOKE`.
- For production, provision the ledger via IaC with least-privilege DB
  roles that structurally cannot `UPDATE`/`DELETE`, rather than relying on
  an in-application `REVOKE` statement.

## Related Documents
- `docs/threat-model.md` — should be updated to record the residual risks
  noted above.
- `docs/adr/0003-s3-object-lock-consideration.md` — analogous
  detection-vs-prevention tradeoff discussion for the S3 storage layer.
