# FILE 3: .kiro/steering/module-registry-update.md
  # ============================================

  ---
  inclusion: always
  ---

  # Module Registry Update Rule

  ## Purpose
  Treat `docs/module-registry.md` as the single source of truth and keep
  it continuously up to date. Diagrams can be auto-generated, but the
  semantic meaning of "why this module exists" is lost unless a human
  or AI explicitly records it.

  ## Update Timing (mandatory, same commit as the code change)

  Update `docs/module-registry.md` in the **same commit** whenever any
  of the following occurs. Do not defer it to a later commit:

  1. A new file is added under `lib/`
  2. A new export (function/class) is added to an existing file
  3. The responsibility of an existing module changes

  ## Registration Format (append entries in this format)

  ```markdown
  | File Path | Main Export | Trust Boundary Layer | Purpose (1 line) | Related Test |
  |---|---|---|---|---|
  | lib/sign/localEcdsaProvider.js | LocalEcdsaProvider | Sign | Generate/verify ECDSA signatures | tests/localEcdsaProvider.test.js |
  ```

  Choose the layer from:
  `Evidence` / `Schema` / `Sign` / `Store` / `Ledger` / `Util`

  ## Coordination with roadmap.md

  If an implemented item was already listed as planned work in
  `docs/roadmap.md`, update its checkbox in the **same commit**:

  ```markdown
  - [x] Implement S3JsonObjectStore (completed: 2026-XX-XX)
  ```

  ## Self-Check (mandatory before finishing output)

  After code generation is complete, self-report the following at the
  end of the output:

  ```
  📋 module-registry.md Update Check:
  - New/changed file: [file path]
  - Added to registry.md: [Done / Not needed (reason)]
  - Reflected in roadmap.md: [Done / Not needed (reason)]
  ```