# AI Agent Evidence Profile

## Purpose

This document defines the first AI-agent-specific evidence profile in Tanden Trust Audit PoC.

The goal is not to save every log line. The goal is to preserve the minimum security-relevant context required for a reviewer to reconstruct and verify an important agent action later.

The profile is intentionally designed around auditability, data minimization, and independent verification.

## Core Question

When an AI agent changes a system, sends a message, updates a record, or invokes a privileged tool, a reviewer should be able to answer:

1. Who or what initiated the action?
2. Which agent and model configuration executed it?
3. Which policy decision applied?
4. Which tool or external system was targeted?
5. Was human approval required and, if so, who approved it?
6. What side effect occurred?
7. Which source documents or policy objects influenced the action?
8. Can the resulting evidence be shown to be unchanged after creation?

## Evidence Is Not the Same as a Log

A log is an observation emitted by a component.

Audit evidence is a structured record that is collected for a control objective and later evaluated by a reviewer.

This PoC therefore separates two concerns:

- observability: what the runtime emitted
- evidence: what must be preserved and verified for audit, incident response, or compliance review

The current repository implements the evidence integrity pipeline. Runtime collectors for specific agent frameworks are planned.

## Profile

The canonical schema is:

~~~text
schemas/ai-agent-evidence.schema.json
~~~

The synthetic sample is:

~~~text
samples/ai-agent-tool-call.json
~~~

The profile captures the following categories.

| Category | Examples | Why it matters |
|---|---|---|
| Actor | human, service, agent identifier | attribution |
| Agent | agent ID, version, prompt-config digest | configuration traceability |
| Model | provider, model ID, model version | model provenance |
| Execution | trace ID, session ID, task ID | correlation and reconstruction |
| Policy | policy ID, version, allow/deny decision | authorization context |
| Action | tool name, operation, target | what the agent attempted |
| Approval | required, status, reviewer, timestamp | human oversight |
| Side effect | resource, outcome, category | what actually changed |
| Context references | policy/RAG/tool-result references and digests | evidence lineage without copying sensitive payloads |
| Artifacts | output/change/report references and digests | result traceability |
| Metadata | environment, PII/secrets flags, retention class | governance context |

## Data-Minimization Rule

The profile intentionally does not define raw prompt, raw response, secrets, credentials, or full customer payload fields.

Where possible, store:

- a stable reference
- a version
- a SHA-256 digest
- a trace or correlation identifier

instead of copying sensitive content into the evidence record.

This is not a universal legal rule. It is the default security posture for this PoC and should be adapted with qualified privacy, audit, compliance, and legal review.

## Trust Boundary

The repository-wide invariant remains:

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

For agent workloads, the intended target flow is:

~~~text
AI Agent / SaaS
      ↓
Runtime collector or adapter        planned
      ↓
AI Agent Evidence envelope
      ↓
JSON Schema validation
      ↓
Cryptographic signing
      ↓
Versioned evidence storage
      ↓
Append-only signing ledger
      ↓
Immutable retention                target
      ↓
External trust anchor              optional
~~~

The external anchor is optional and is not the primary product boundary.

## What the Current PoC Can Demonstrate

The current implementation can:

- validate the AI agent evidence profile
- canonicalize evidence deterministically with RFC 8785 JCS
- calculate SHA-256 evidence digests
- sign evidence with the existing signing-provider abstraction
- persist versioned evidence through the existing store abstraction
- record signing events in the PostgreSQL hash-chained ledger
- verify evidence integrity after loading
- optionally extend proof outside the primary storage boundary

The current repository does not yet contain an automatic production collector for a live AI agent runtime.

## Security Properties

The target evidence layer is designed around the following properties.

| Property | Meaning |
|---|---|
| Integrity | later modification is detectable |
| Attribution | actor, agent, signer, and approval context can be linked |
| Context | model, policy, tool, and execution context are preserved |
| Completeness | expected event sequences can eventually be checked for gaps |
| Reconstruction | a reviewer can reconstruct the important control path |
| Verifiability | a reviewer can independently reperform checks |
| Minimization | sensitive payloads are not copied without a clear need |
| Retention | evidence can be preserved for the required period |

Not all properties are fully implemented in the current PoC. In particular, production identity, runtime collection, completeness proofs, immutable retention deployment, and formal control mappings remain work in progress.

## What This Does Not Prove

Cryptographic integrity does not prove that an original event was truthful.

A correctly signed record can still contain incorrect source data if the producer was compromised or the original observation was wrong.

The design must therefore combine evidence integrity with:

- trusted producer identity
- least-privilege access
- independent telemetry
- policy evaluation
- human approval where appropriate
- monitoring and incident response

## Next Implementation Slice

The next product-oriented implementation should add one runtime adapter that converts a security-relevant AI agent event into this schema without changing the core trust boundary.

Preferred acceptance criteria:

1. collect one tool-call event from an agent runtime
2. map it to the AI Agent Evidence profile
3. exclude raw secrets and sensitive payloads by default
4. process it through EvidenceProcessingService
5. store and verify the resulting evidence
6. demonstrate tampering detection
7. show the evidence bundle to an auditor or compliance practitioner for feedback

