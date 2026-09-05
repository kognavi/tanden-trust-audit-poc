# Design: Local-First Live Agent Collector

## Architecture

```text
Fixture or Live Agent Event
          ↓
Collector Adapter
          ↓
Normalized Agent Event
          ↓
AI Agent Evidence Mapper
          ↓
AI Agent Evidence Schema
          ↓
EvidenceProcessingService
          ↓
Schema → Sign → Store → Ledger
```

## Adapter Boundary

The collector is split into two responsibilities:

- runtime adapter: understands a specific source format
- evidence mapper: converts normalized event data into the repository AI Agent Evidence profile

The mapper must not depend directly on AWS SDK event shapes.

## Default Development Path

```text
Synthetic fixture
   ↓
Fixture adapter
   ↓
Mapper
   ↓
Local ECDSA
   ↓
Local/Docker PostgreSQL or test doubles
   ↓
Verification
```

This path must remain usable without AWS credentials.

## Manual AWS Path

A later adapter may capture one real Agent tool call.

```text
AWS Agent runtime
   ↓
AWS adapter
   ↓
Normalized event
   ↓
same mapper
   ↓
same Evidence pipeline
```

Only the source adapter changes.

## Data Minimization

Do not copy raw prompts or tool credentials by default.

Prefer:

- `traceId`
- `sessionId`
- `agentVersion`
- `modelId`
- `policyId`
- `toolName`
- `target`
- `approval`
- `sideEffect`
- reference + digest pairs

## Cost Boundary

Default GitHub Actions has no AWS OIDC permission.

A separate manual workflow owns AWS credential exchange and real integration tests.
