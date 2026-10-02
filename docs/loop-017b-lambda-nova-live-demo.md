# Loop 017B — completed Lambda/Nova fallback PoC

This additive fallback starts from approved commit `9148c8451d7b092397ecdf5b3fb1d37c64233546`. Amazon Bedrock AgentCore Runtime remains **BLOCKED** after repeated `CreateAgentRuntime AccessDenied`; Loop 017B does not resolve that failure or rewrite Loop 017 evidence. The reproducible identifiers are recorded in `knowledge/30-learnings/loop-017b-agentcore-blocked.md`.

## Current final state (2026-10-01)

Loop 017B is **COMPLETE** for the approved one-shot Lambda + Nova 2 Lite fallback and local/test Evidence path. G3 deployment/state reconciliation completed; the final verified Terraform plan was **No changes**. G4 verified one Lambda execution and one successful Nova 2 Lite `Converse` in the recorded observation window. G5 validated schemas, signed with `LocalEcdsaProvider`, completed Store/Ledger test processing, verified the reloaded signature **PASS**, and verified a tampered clone **FAIL** as expected. These are prior verified results; this documentation update performs no AWS read or additional inference.

Store is the existing **memory implementation** and Ledger is the existing **test double**. Exported files do not demonstrate PostgreSQL durability or a production durable/hash-chained ledger. AgentCore Runtime remains **BLOCKED** and its prior history is unchanged. **AWS cleanup is PENDING**; the deployed resources have not been reported deleted and need separate cleanup approval and deletion verification.

Portable records are in `evidence/loop017b/ecece0b3-4981-4d6e-859d-cb471941f243/`: `g4-reconciliation.json` documents the prior live reconciliation and its provenance, and `g5/verification-report.json` plus `g5/artifact-manifest.json` retain local verification and hashes. Original local evidence is unchanged, archived outside Git, and ignored under `loop017b-live/`.

Terraform describes **4 Terraform managed resources** across **3 major resource types: IAM, CloudWatch Logs, Lambda**: IAM role, IAM inline role policy, CloudWatch log group, and Lambda function.

## Local contract

`lambda/loop017b/handler.js` accepts only `{ "runId": "<UUID>" }`. It owns the fixed synthetic prompt, single tool specification, target `synthetic://loop-017b/resource/demo-1`, model profile `jp.amazon.nova-2-lite-v1:0`, and source Region `ap-northeast-1`. It sends one non-streaming `Converse` request through an SDK client configured with `maxAttempts: 1`, validates exactly one allowed tool use, performs a local no-op, and returns a wrapper-built normalized event plus allowlisted receipt. No tool result is sent back to Nova. An ambiguous Bedrock failure is terminal for that approval; do not retry.

The local collector rejects unexpected response fields, input-digest drift, identity/correlation mismatch, changed synthetic action or policy facts, and PII/secrets flags. It compares the entire normalized event with the wrapper's deterministic expected event, so free-form fields such as `metadata.notes` and `model.modelVersion` cannot carry supplied content into Evidence. The processor uses the existing normalized-event schema, mapper, AI Agent Evidence schema, and `EvidenceProcessingService`. The order is `Evidence → Schema → Sign → Store → Ledger`; after Ledger success it reloads the local demo Store, verifies the signature and digest, and confirms that a tampered clone fails. Its Store is in-memory and Ledger is a double. This proves local behavior, not PostgreSQL durability or AWS storage.

No prompt body, raw model output, raw tool arguments, real PII, secrets, or private key enters the returned summary. Application logs contain only run/request IDs and status. The wrapper response must be treated as a limited producer observation, not proof that a model statement is true.

## Offline use and validation

Tests use an injected fake Bedrock client and make no AWS call:

```sh
node --test tests/lambda-nova-*.test.js tests/loop017b-model-logging-gate.test.js
npm run check:structure
terraform fmt -check infra/loop017b-lambda/main.tf
terraform -chdir=infra/loop017b-lambda validate
git diff --check
```

Once a separately approved live run produces an already sanitized Lambda response, process it locally with `npm run demo:lambda-nova:process -- <sanitized-response.json> <summary.json> <run-id>`. This command makes no AWS call. Never pass a raw Bedrock response to it. Retain the summary under a new Loop 017B evidence location only.

## Approval boundaries for any future operation

The isolated Terraform root is `infra/loop017b-lambda/`. Deployment requires its own GO after source ZIP digest, IAM, profile destinations, cost ceiling, and cleanup are reviewed. Terraform apply is outside local implementation. A further GO must approve one synchronous Lambda invocation. Reserved concurrency is not configured for this one-off PoC because the reported account concurrency quota is 10 and AWS requires 10 unreserved slots. The function has no automatic event source, Function URL, API Gateway, EventBridge, queue, or other trigger. G4 permits exactly one intended human-approved synchronous invocation with caller and SDK retries disabled. Ambiguous outcomes are `INDETERMINATE`: stop without retrying. A second authorized manual invocation remains technically possible; production deployment must restore a technical concurrency/idempotency control that rejects duplicate or concurrent requests. These operational controls do not prove exactly-once execution. The live proof must correlate one Lambda execution, its request ID, one matching CloudTrail `Converse` event and Bedrock request ID, timestamps, executing role, model/profile, usage, and the sanitized Evidence verification result. A missing or ambiguous observation is not PASS. AgentCore status remains **BLOCKED**.

For this one-off PoC deployment only, G3 may accept the existing human SSO Administrator principal (human session identity omitted from Git) as deployment principal. Recheck the exact STS identity immediately before apply. The AdministratorAccess grant is intentionally accepted only for this human-operated PoC; it is never delegated to the Lambda. Every planned Terraform mutation must match the reviewed plan for 4 Terraform managed resources across 3 major resource types: IAM, CloudWatch Logs, Lambda and reviewed ZIP digest; any changed resource, action, configuration, or artifact means **G3 NO-GO**. Explicit human G3 approval is required before apply. The Lambda execution role remains limited to the reviewed Bedrock profile/model ARNs and its log stream. Production or reusable deployment requires a dedicated least-privilege deploy role and a new review.

### Historical reserved-concurrency failure and completed state reconciliation

The original attempt to reserve concurrency `1` failed because the account quota was 10 and AWS required 10 unreserved slots. All four reviewed managed resources existed, but Terraform marked `aws_lambda_function.nova_demo` tainted. Removing the reserved-concurrency configuration did not itself clear the taint.

Under separate approval, state was backed up and only the existing Lambda was untainted. The subsequent refresh-enabled plan had **0 to add, 0 to change, 0 to destroy** with only the missing `lambda_function_arn` output. The exact output-only saved plan was applied to reconcile Terraform output state; no AWS resource mutation occurred. The final verified plan reported **No changes. Your infrastructure matches the configuration.** These are historical completed operations, not pending repair instructions. This update changes neither Terraform configuration nor state. Future plan drift requires a new review and approval; G4 completion does not authorize another inference.

### Required read-only pre-Nova logging gate

After deployment approval, before the separate Nova GO, inspect the account-level Bedrock model invocation logging configuration in Tokyo and Osaka. Run the following standalone block from the repository root. It is an instruction for a future approved preflight and only reads configuration. Use an operator identity authorized for `bedrock:GetModelInvocationLoggingConfiguration`; do not change the logging configuration.

```sh
set -euo pipefail
umask 077
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/loop017b-logging-precheck.XXXXXXXX")"
bash scripts/check-loop017b-model-logging.sh "$RUN_DIR"
```

The standalone precheck creates its own private `RUN_DIR`; keep its read-only results with the gate decision. The script checks Tokyo and Osaka and distinguishes AWS CLI failure from a successful empty stdout. With AWS CLI 2.33.2, an empty API object can produce empty stdout. In that case, a second read using `--query 'to_string(@)' --output text` must yield exactly `{}`. Otherwise only a single `{}` or `{"loggingConfig":{}}` response passes. A command failure, second-read failure, destination, enabled delivery flag, unfamiliar field, malformed or multiple JSON values, or any nonempty `loggingConfig` means **Nova GO = NO-GO**. Do not change Bedrock logging configuration as part of Loop 017B. Model invocation logging can retain model input and output; the Lambda's sanitized application logs do not disable account-level Bedrock logging.

### Future one-shot `RequestResponse` procedure

Use this only after deployment GO, deployed ZIP/input digest and role review, the read-only logging gate above, and a **separate one-shot inference GO**. Review the exact function ARN and operator identity first. Run the block once from the repository root with AWS CLI and `jq` available. It records the run ID and invocation intent before any model call. The `RUN_DIR` must be new; an existing directory stops the block. This one-shot block repeats the logging reads in its own `RUN_DIR`; both must pass before the `aws lambda invoke` line. No event source, asynchronous trigger, shell retry loop, or second invocation is part of this procedure.

```sh
set -euo pipefail
umask 077
FUNCTION_ARN='arn:aws:lambda:ap-northeast-1:270887329967:function:tanden-loop017b-nova'
RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
mkdir -p loop017b-live
RUN_DIR="loop017b-live/${RUN_ID}"
mkdir -m 700 "$RUN_DIR"
jq -n --arg runId "$RUN_ID" --arg functionArn "$FUNCTION_ARN" \
  --arg recordedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{runId:$runId,functionArn:$functionArn,recordedAt:$recordedAt,status:"INTENDED"}' \
  > "$RUN_DIR/invocation-intent.json"

bash scripts/check-loop017b-model-logging.sh "$RUN_DIR"

if ! AWS_MAX_ATTEMPTS=1 AWS_RETRY_MODE=standard aws lambda invoke \
  --function-name "$FUNCTION_ARN" --region ap-northeast-1 \
  --invocation-type RequestResponse --cli-binary-format raw-in-base64-out \
  --cli-connect-timeout 10 --cli-read-timeout 100 --no-cli-pager \
  --payload "$(jq -nc --arg runId "$RUN_ID" '{runId:$runId}')" \
  "$RUN_DIR/lambda-response.json" > "$RUN_DIR/invoke-metadata.json"; then
  jq -n --arg runId "$RUN_ID" '{runId:$runId,status:"INDETERMINATE"}' > "$RUN_DIR/outcome.json"
  exit 1
fi
if ! jq -e '(.StatusCode == 200) and (.FunctionError == null)' "$RUN_DIR/invoke-metadata.json" >/dev/null || \
   ! jq -e --arg runId "$RUN_ID" '(.runId == $runId) and (.source == "aws-lambda-bedrock-nova-loop017b")' \
     "$RUN_DIR/lambda-response.json" >/dev/null; then
  jq -n --arg runId "$RUN_ID" '{runId:$runId,status:"INDETERMINATE"}' > "$RUN_DIR/outcome.json"
  exit 1
fi
```

`AWS_MAX_ATTEMPTS=1` disables caller retries for both read-only checks and the one synchronous invoke; the Lambda Bedrock SDK also uses `maxAttempts: 1`. The Lambda logs `ATTEMPTING` with run ID and Lambda request ID before its Bedrock call and logs `INDETERMINATE` with those IDs on an SDK failure. If Lambda times out or the CLI response is lost, Lambda cannot return a reliable result: mark that run **INDETERMINATE**, use the pre-call correlation log and CloudTrail for read-only investigation, and **stop without retrying under the same GO**. A CLI success still needs one matching Lambda execution and one matching successful CloudTrail `Converse` event before a live PASS claim. Process only the sanitized Lambda response locally and retain the resulting summary under this Loop 017B run directory.

### Cleanup after evidence preservation and separate approval

First preserve the sanitized summary, IDs, CloudTrail correlation, deployed ZIP digest, and reviewed Terraform plan. Obtain a separate cleanup GO; review `terraform -chdir=infra/loop017b-lambda plan -destroy -var="lambda_zip_path=<reviewed-local-zip>"` against the isolated state, then destroy only that reviewed Loop 017B plan. Do not delete CloudTrail history or any AgentCore evidence.

After cleanup, perform these read-only checks and retain their sanitized results with the Loop 017B run record:

```sh
AWS_MAX_ATTEMPTS=1 aws lambda get-function --region ap-northeast-1 \
  --function-name tanden-loop017b-nova
AWS_MAX_ATTEMPTS=1 aws iam get-role --role-name TandenLoop017BLambdaExecutionRole
AWS_MAX_ATTEMPTS=1 aws logs describe-log-groups --region ap-northeast-1 \
  --log-group-name-prefix /aws/lambda/tanden-loop017b-nova \
  --query "logGroups[?logGroupName=='/aws/lambda/tanden-loop017b-nova'].logGroupName"
```

The first two calls must fail specifically with `ResourceNotFoundException` and `NoSuchEntity` respectively; `AccessDenied` or a network error does not prove deletion. The last query must return `[]`. Verify Terraform state has no remaining Loop 017B resources. This procedure does not authorize cleanup now.
