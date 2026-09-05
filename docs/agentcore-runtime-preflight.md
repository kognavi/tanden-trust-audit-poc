# Minimal AgentCore Runtime Preflight

This preflight catches TypeScript/API drift before the one-time AWS deployment.

The workflow `.github/workflows/agentcore-runtime-check.yml`:

1. uses Node.js 22
2. installs only the nested Runtime dependencies
3. runs `tsc --noEmit`
4. does not request AWS credentials
5. makes no AWS API calls

It intentionally does not deploy AgentCore, invoke Bedrock, create IAM roles, create CloudFormation stacks, create S3/CDK assets, or call the live Runtime.
