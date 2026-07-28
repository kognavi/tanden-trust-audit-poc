 # FILE 2: .kiro/steering/dependency-check.md
  # ============================================

  ---
  inclusion: always
  ---

  # Trust Boundary & Dependency Guard (Dependency Check)

  ## Purpose
  This project's trust boundary follows a fixed, one-directional flow.
  Reversing or skipping this order destroys the core tamper-detection
  design of the system.

  ```
  Evidence → Schema (validate) → Sign → Store → Ledger (record)
  ```

  ## Absolute Rules (must not be violated)

  1. **The Store layer must never call the Sign layer directly.**
     (It only receives already-signed data. Embedding signing logic
     inside Store is forbidden.)
  2. **The Ledger layer must never accept data that has not passed
     through the Sign layer.**
     (Writing unsigned evidence directly to the ledger breaks the
     trust boundary.)
  3. **Data must never reach the Sign layer without passing Schema
     validation.**
     (Always run it through validators such as
     `validateSidecarMetadataV1` first.)

  ## Required Process (mandatory when structure changes)

  Whenever you add or modify an import statement under `lib/`,
  perform the following:

  1. Before making the change, check the current dependency structure:
     ```bash
     npx madge --circular lib/
     ```
  2. After the change is complete, run it again and verify that
     **no new circular dependency has been introduced**.
  3. If a circular dependency is detected, **do not auto-fix it.**
     Immediately report it to the human (Ken) using this format:
     ```
     ⚠️ Circular dependency detected:
     [details]
     Which layer of the trust boundary flow
     (Evidence → Schema → Sign → Store → Ledger)
     does this change affect? Please advise.
     ```
  4. If any change touches `lib/sign`, `lib/store`, or `lib/ledger`,
     propose regenerating `docs/callgraph.svg` before committing:
     ```bash
     npx madge --image docs/callgraph.svg lib/
     ```

  ---