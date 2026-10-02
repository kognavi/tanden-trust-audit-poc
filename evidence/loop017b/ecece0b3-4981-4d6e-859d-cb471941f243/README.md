# Loop 017B completed PoC evidence

Loop 017B is **COMPLETE** for the approved Lambda/Nova fallback and local/test evidence path. AgentCore Runtime remains **BLOCKED**. AWS cleanup is **PENDING** and requires separate approval.

`g4-reconciliation.json` records the previously verified one Lambda execution and one successful Nova 2 Lite Converse in the stated observation window. It is a sanitized transcription of prior verified observations, not a fresh AWS check or an AWS-native signed export. No second inference was performed to prepare these files. Request IDs support correlation; a signature over wrapper Evidence does not authenticate CloudTrail or prove global exactly-once behavior.

`lambda-response.json` is the saved sanitized wrapper response. The G5 signed record uses the existing AI Agent Evidence schema and LocalEcdsaProvider (RFC 8785 JCS, SHA-256, ECDSA_SHA_256 / secp256k1). Store reread signature verification was PASS; a clone with `action.target` changed by `#tampered` was FAIL as expected. The public key permits offline verification. No private key is included.

Store is the existing **memory implementation**. Ledger is the existing **test double**; `ledger-receipt.json` records its request/receipt. Exported JSON files do not turn either into production durable storage or a hash-chained production ledger.

All evidence paths are repository-relative. `g5/artifact-manifest.json` covers the selected files except itself with SHA-256 and byte counts; these hashes are integrity checks, not signatures. Existing normalized-event and AI Agent Evidence schemas validate the event and Evidence. The response, normalized event, and mapped Evidence must match the fixed wrapper contract.

Original local files were copied unchanged to a private archive outside Git and remain in the ignored local run directory. Raw CloudTrail/log exports, raw logging-check JSON, invocation intent/CLI metadata, duplicate normalized-event export, ZIPs, Terraform state/backups, plans, binaries, credentials, and personal paths are excluded from this Git evidence set.
