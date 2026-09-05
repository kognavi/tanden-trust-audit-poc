# Minimal AgentCore Runtime Deployment

## Goal

Deploy one small Amazon Bedrock AgentCore Runtime only long enough to prove the live Evidence path, invoke it once, preserve the sanitized result, then remove it.

This is not a production deployment.

## Selected configuration

- Region: `ap-northeast-1`
- Runtime: Amazon Bedrock AgentCore Runtime
- Language runtime: Node.js 22
- Build: CodeZip
- Protocol: HTTP
- Agent framework: Strands Agents TypeScript
- Model: Amazon Nova 2 Lite
- Model ID: `jp.amazon.nova-2-lite-v1:0`
- Tool count: 1
- External side effects: synthetic only
- Persistent database: none
- NAT Gateway: none
- OpenSearch: none
- ECS/EC2: none
- KMS/S3 writes from the demo agent: none

## Cost design

The model request is intentionally tiny: one model invocation, one tool call, `maxTokens: 128`, `temperature: 0`, and a 15-second cooperative cancellation signal.

The Runtime is not meant to remain deployed.

## Local preflight

From `app/TandenEvidenceDemo/`:

    npm install --ignore-scripts --no-audit --fund=false
    npm run typecheck

This does not call AWS.

## AgentCore CLI

Use the current CLI release documented by AWS:

    npm install -g @aws/agentcore@0.24.2
    agentcore --version

The repository contains `agentcore/agentcore.json` and `agentcore/aws-targets.example.json`.
Create `agentcore/aws-targets.json` from the example, replace the account ID with the demo AWS account, and keep the file local.

## Preview first

Before creating resources:

    agentcore deploy --dry-run

Review the generated resources before continuing.

## Human approval boundary

The real deploy creates AWS resources and may create IAM roles, a Runtime, CloudFormation resources, and a CDK staging S3 asset. Therefore the real deploy is intentionally not part of normal CI.

After reviewing the dry run, the human operator may explicitly run:

    agentcore deploy

## Invoke exactly once

After deployment, obtain the Runtime ARN and run the existing GitHub Actions workflow `AgentCore Live Evidence Demo` with:

- `confirm_cost = RUN`
- Runtime ARN
- qualifier = `DEFAULT`
- Region = `ap-northeast-1`

Expected proof:

- original verification = PASS
- tampered verification = FAIL

## Cleanup

After the proof is captured, run `agentcore status`, remove the runtime from the AgentCore project configuration, and deploy the updated project so the CLI tears down the removed resources. Then verify in the AWS Console that the Runtime and associated CloudFormation resources are gone.

## Evidence to preserve

Preserve only a sanitized proof under `docs/demo/` containing the run date, Region, Runtime ARN SHA-256, Evidence ID, trace/session correlation IDs, Evidence digest, original PASS, tampered FAIL, and cleanup confirmation.

Never preserve raw Runtime request/response data, credentials, secrets, or unnecessary PII.
