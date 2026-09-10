# Codex Real Provider Adapter

## Purpose

Loop 011 connects the provider-neutral Runtime Adapter to a real Codex CLI process for the Reviewer role.

This is intentionally Reviewer-only. It establishes the real-provider contract before granting a provider write-capable Builder authority.

## Configure

Initialize the normal runtime first:

```bash
npm run agent:runtime:init -- <feature-slug>
```

Opt the Reviewer into Codex CLI locally. The command writes `.kiro/specs/<feature>/agent-runtime.local.json`, which is ignored by Git:

```bash
npm run agent:runtime:codex-review -- <feature-slug> [timeout-ms]
```

Then, when the Task Graph marks Reviewer READY:

```bash
npm run agent:runtime:run -- <feature-slug> reviewer
```

## Codex invocation

The adapter launches the Codex CLI without a shell:

```text
codex exec
  --json
  --ephemeral
  --ignore-user-config
  --sandbox read-only
  --output-schema schemas/codex-review-result.schema.json
  --output-last-message <temporary-file>
  -
```

The generated review instructions are provided through stdin. `--ephemeral` avoids persisting the Codex session rollout, while `--ignore-user-config` reduces user-level configuration drift; authentication remains the Codex CLI responsibility.

## Two separate outcomes

The adapter distinguishes provider execution from semantic review:

```text
Process exit 0
  ≠
Review PASS
```

A successful Codex process may still return a FAIL verdict if blocking findings exist.

## Result handling

- valid verdict PASS → write reviewer-review.md → reviewer-pass
- valid verdict FAIL → write reviewer-review.md → reviewer-fail
- timeout → TIMEOUT → reviewer-fail
- CLI missing / non-zero process exit / invalid structured output → PROVIDER_ERROR → no Task Graph transition

This keeps operational provider failures separate from an actual negative code review.

## Provider provenance

Run Evidence may contain:

- provider name
- provider session/thread ID
- provider execution status
- process exit code
- sandbox mode
- SHA-256 digest of prompt
- SHA-256 digest of stdout
- SHA-256 digest of stderr
- SHA-256 digest of structured final message

It does not persist raw prompt, stdout, stderr, credentials, tokens, or raw provider responses.

## Review artifact

A valid Codex verdict generates:

```text
.kiro/specs/<feature>/reviewer-review.md
```

The artifact records Status, delegated Reviewer identity, provider/session provenance, summary, and findings.

Verification still checks that Reviewed by matches the delegated Reviewer identity.

## Safety boundary

The initial real provider has:

- Reviewer role only
- committed runtime remains dry-run
- real provider requires ignored local override
- read-only Codex sandbox is enforced in code
- shell=false process launch
- no merge or deploy authority
- no automatic IAM/AWS changes
- no automatic Builder write authority

## Cost boundary

Real Codex CLI execution can consume the user's configured Codex/ChatGPT/API allowance depending on authentication and account configuration.

CI does not invoke the real Codex provider. Tests inject a deterministic mock process runner.

## Future work

Potential future loops may add:

- Codex Builder adapter with explicit write controls
- app-server based long-lived sessions
- Kiro or Work runtime adapters
- cancellation and remote-run lifecycle
- stronger provider identity attestation
