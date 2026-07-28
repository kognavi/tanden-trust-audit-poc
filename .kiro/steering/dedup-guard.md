  # FILE 1: .kiro/steering/dedup-guard.md
  # ============================================

  ---
  inclusion: always
  ---

  # Duplicate Implementation Guard (Dedup Guard)

  ## Purpose
  In solo development, the biggest risk is forgetting that a similar feature
  was already built and re-implementing it from scratch. Before generating
  any new code, always check for duplication against existing implementations.

  ## Trigger Conditions
  Execute this process **before** code generation whenever the request
  contains keywords such as:
  - "add", "create new", "implement", "build"

  ## Required Process (mandatory, do not skip)

  1. Read `docs/module-registry.md` and review the list of existing
     functions, classes, and modules.
  2. Determine which layer the requested feature belongs to:
     - **Evidence layer**: evidence hashing / canonicalization (JCS)
     - **Schema layer**: JSON Schema validation (ajv)
     - **Sign layer**: `LocalEcdsaProvider` / `AwsKmsProvider`
     - **Store layer**: `LocalJsonObjectStore` / `S3JsonObjectStore`
     - **Ledger layer**: Postgres tamper-evident chain
       (`appendEvent`, `verifyChainIntegrity`)
  3. If the purpose overlaps 70% or more with an existing module,
     **refuse to create a new module** and instead propose extending
     the existing one.
  4. Always state the following at the beginning of the output:

  ```
  🔍 Duplication Check Result:
  - File checked: docs/module-registry.md
  - Existing similar implementation: [Yes/No] → [file path]
  - Decision: [New module / Extend existing] (Reason: ...)
  ```

  ## Concrete Example (from this project)

  - ❌ BAD: "Create a function to compute a hash" →
    creates a brand-new `Sha256Helper.js`
  - ✅ GOOD: Check the existing `computeRowHash` (Ledger layer) or the
    evidence hash verification module (Evidence layer) first. Only create
    a new module if the purpose is genuinely different, and record which
    layer it belongs to in `module-registry.md`.

  ---