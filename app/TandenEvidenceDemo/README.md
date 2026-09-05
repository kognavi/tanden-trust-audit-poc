# Tanden AgentCore Evidence Demo Runtime

This directory contains the smallest live Runtime needed to prove the portfolio path.

## Runtime shape

- Amazon Bedrock AgentCore Runtime
- Node.js 22
- CodeZip deployment
- HTTP protocol
- Strands Agents TypeScript
- Amazon Nova 2 Lite via `jp.amazon.nova-2-lite-v1:0`
- one synthetic local tool only
- no database
- no S3/KMS writes from the agent
- no real customer data

## Why Nova 2 Lite

The demo needs only enough model reasoning to call one synthetic tool. The model is configured with:

- `maxTokens: 128`
- `temperature: 0`
- a 15-second invocation timeout

The purpose is evidence collection, not model quality benchmarking.

## Request contract

The existing GitHub Actions live workflow sends:

```json
{
  "prompt": "Run the configured portfolio audit demo tool exactly once.",
  "auditContext": {
    "runtimeSessionId": "<AgentCore runtime session id>",
    "traceId": "<trace id>",
    "evidenceId": "evd-2026-000399"
  }
}
```

The runtime also verifies that the HTTP header
`X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` matches the request body before creating evidence context.

## Response contract

Only the tool execution path creates `auditEvent`.

```json
{
  "result": "synthetic-demo-complete",
  "auditEvent": {
    "eventType": "AGENT_TOOL_CALL"
  }
}
```

The model's free-form text is not copied into the evidence event.

## Local static check

From this directory:

```bash
npm install --ignore-scripts --no-audit --fund=false
npm run typecheck
```

This does not call AWS.

## Deployment

See `docs/agentcore-runtime-deploy.md`.

The live AWS deployment is intentionally not automated from normal CI.
