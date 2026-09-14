---
id: loop-014-kms-signing-api-contract-hardening-learning
type: learning
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - lib/signing-contract.js
  - lib/aws-kms-provider.js
  - lib/local-ecdsa-provider.js
  - tests/cross-provider-parity.test.js
supports:
  - context-pack-loop-014-kms-signing-api-contract-hardening
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 014 Learning: Explicit Raw-message Signing Contract

## What changed

Local ECDSAとAWS KMSの低レベル署名契約を`signRawMessage` / `verifyRawMessageSignature`として明示し、algorithm、curve、KeySpec、MessageType、signature encoding、input validationをshared contractへ集約した。旧`signDigest`系はraw-message semanticsを変えずdeprecated aliasとして維持した。

## Reusable lessons

1. 32-byte Bufferはdigestにもraw messageにもなり得るため、長さから意味を推測してはいけない。API境界で意味を明示する。
2. KMS `MessageType: RAW`とNode `crypto.sign('sha256', message, ...)`は、同一messageを内部で一度hashする契約として揃えられる。
3. method renameでは旧methodの意味を変更せずaliasとして残す方が、silent cryptographic breakを防げる。
4. malformed signatureはservice failureではなくverification failureとして`false`にし、既存のtamper-detection audit eventを維持する。
5. invalid message、wrong curve、wrong KeySpecは外部crypto/KMS operation前にfail closedで拒否する。
6. module registryと設計文書のcurve記述もcode/testsと同時に更新しないと、正しい実装が誤った運用判断に負ける。

## Residual limitations

- deprecated aliasは互換性のため残るので、完全削除には別Loopとmigration evidenceが必要である。
- JavaScriptのBuffer自体にはraw/digestの型情報がない。強いcompile-time区別にはTypeScriptやbranded type等の別設計が必要である。
- real AWS KMS integration、IAM、CloudTrail、key lifecycleはこのLoopの対象外である。

## Next action

Independent ReviewerとSecurity Reviewerが、single-hash semantics、legacy compatibility、fail-closed behavior、AWS/IAM/KMS変更不在を確認する。
