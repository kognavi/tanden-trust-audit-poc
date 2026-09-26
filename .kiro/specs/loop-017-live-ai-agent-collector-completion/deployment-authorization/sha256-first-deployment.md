# Loop 017 SHA-256-first direct CloudFormation authorization

Status: local design reviewed; **AWS deployment NO-GO** until the documented writer, upload, verification and human-approval gates pass. This is an operator procedure, **not** authorization to make an AWS call, change IAM, upload an object, or create a stack. Keep all earlier design and failed review records intact.

## Reviewed inputs

- Account/region: `270887329967` / `ap-northeast-1`.
- Existing private, versioned, SSE-S3 bucket: `tanden-trust-audit-poc-test-bucket`.
- CodeZip key: `loop-017/agentcore/TandenEvidenceDemo/ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c/deployment_package.zip`; SHA-256 `ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c`.
- Template key: `loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml`; SHA-256 is pinned in `authorization-provenance.json` under `sha256FirstDeployment.templateSha256` and must match the committed template and downloaded S3 bytes.
- CloudFormation `TemplateUrl`: `https://s3.ap-northeast-1.amazonaws.com/tanden-trust-audit-poc-test-bucket/loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml`.
- The **independently reviewed commit SHA-1** identifies the reviewed policy, template, verifier and expected SHA-256 values. Supply that exact SHA to `--expected-commit`; do not obtain it by blindly evaluating the current `git rev-parse HEAD` at deployment time. Do not deploy from a dirty tree or an unreviewed commit.

The template and one-shot IAM policy do not contain either S3 VersionId. S3 VersionIds remain the observed provenance from `get-object` receipts. Their earlier values in `finalizedVersionFreeze` and other historical manifest entries are **historical**, not executable authorization inputs. The sole Runtime resource has PUBLIC networking and the exact execution role, model and tags. IAM still limits stack name/account/region, TemplateUrl, `ResourceTypes`, Tanden request tags/CodeZip digest, no-VPC inputs, PassRole and the dependent endpoint's required CloudFormation request tags and account/Region `runtime/*` resource. The FAS conditions are absent from that dependent endpoint statement following the reported AccessDenied; IAM alone no longer limits a matching request to the named runtime or a CloudFormation-origin call. The one-shot role can read only the two listed objects, cannot replace either, and no longer needs `s3:GetObjectVersion`.

## Mandatory pre-deploy gate (future human-run; never automatic)

Only after separate approval for read-only AWS access, from a clean checkout at the **independently approved** Git commit and using an authorized read-only identity. Set `REVIEWED_GIT_SHA` from the human-reviewed decision record, not from the current checkout. First inspect who can write these exact two S3 keys through IAM identities, bucket/access-point policies and organizational controls. Obtain a human-confirmed no-write window for those keys through completion of service reads. If independent writers cannot be excluded or controlled, stop and use the VersionId-pinned design instead.

```bash
set -euo pipefail
cd /path/to/tanden-trust-audit-poc
scratch_dir="$(mktemp -d)"
trap 'rm -rf -- "$scratch_dir"' EXIT

aws s3api get-object --region ap-northeast-1 --expected-bucket-owner 270887329967 \
  --bucket tanden-trust-audit-poc-test-bucket \
  --key loop-017/agentcore/TandenEvidenceDemo/ea9dee6f3887a16d2362d88cf9ed68a3716bcaacb7b9830e5c3d5e9f3184488c/deployment_package.zip \
  "$scratch_dir/codezip.zip" > "$scratch_dir/codezip-receipt.json"
aws s3api get-object --region ap-northeast-1 --expected-bucket-owner 270887329967 \
  --bucket tanden-trust-audit-poc-test-bucket \
  --key loop-017/agentcore/TandenEvidenceDemo/initial-create.template.yaml \
  "$scratch_dir/template.yaml" > "$scratch_dir/template-receipt.json"

node scripts/verify-loop-017-deployment-inputs.js \
  --expected-commit "$REVIEWED_GIT_SHA" \
  --codezip-file "$scratch_dir/codezip.zip" \
  --codezip-receipt "$scratch_dir/codezip-receipt.json" \
  --template-file "$scratch_dir/template.yaml" \
  --template-receipt "$scratch_dir/template-receipt.json"
```

The verifier fails on a wrong or unreviewed Git HEAD, dirty Git, changed committed template/policy/provenance, missing VersionId, or a byte-level SHA-256 mismatch. Keep only its nonsecret output (reviewed Git HEAD, SHA-256, bucket/key, observed VersionIds) as deployment provenance. Do not persist downloaded ZIP contents or raw credentials. Do **not** rely on ETag, user-provided `ArtifactSha256` tags, or only S3 metadata for the SHA check. After a PASS, separately authorize stack creation and use **exactly** the unversioned TemplateUrl above with `--resource-types AWS::BedrockAgentCore::Runtime`; no `--capabilities`, TemplateBody, parameters, change set, or stack update. A failed gate is a stop, not a reason to widen IAM. No preflight invokes or deploys AgentCore.

## Integrity limit and tradeoff

VersionId-pinned authorization forces CloudFormation/AgentCore to consume the specific S3 versions written in IAM/template. The SHA-256-first procedure checks the bytes downloaded at preflight, but CloudFormation's unversioned template URL and the Runtime's versionless CodeZip location resolve the **latest** version when the services read them. IAM does not enforce a byte-level hash of S3 objects. A principal that can write either exact key could replace it after verification and before those reads; even a second preflight check cannot make the later read atomic. The Runtime's `ArtifactSha256` request tag records expected provenance but does not validate CodeZip bytes.

PoC acceptance depends on a trusted artifact publisher, confirmed exclusive/no-write window for both exact keys through CloudFormation and AgentCore reads, the deploy role's read-only S3 permissions, and short-lived, supervised creation. `ResourceTypes` limits types but **not Runtime count or properties**: a substitute template could declare additional Runtimes using the dependent endpoint's account/Region `runtime/*` resource scope if it carries the required tags. The operator-reported simulation evaluates the literal `runtime/*` resource and returns `implicitDeny` for the previously narrowed resource despite complete tag context; live AgentCore authorization remains unverified. Inspect version history immediately before and after creation, preserve the VersionIds and stop without invocation if either changed. These checks do not remove the race: if an independent actor can rewrite either key in that window, or exclusive control is unverified, this design is **NO-GO**. Use the prior VersionId-pinned design or separately reviewed immutable, write-once object controls. Never treat the Git hash as a substitute for checking the actual uploaded bytes. CloudFormation and AgentCore do not offer a transactional joint SHA check for both objects here.

The simplification removes VersionId-driven template regeneration, template re-upload and policy revision/review cycles; it **adds** two required read/download/hash checks and a publishing authority check. It is a reduction in deployment dependencies, not necessarily in total AWS API calls. The currently known S3 template version has SHA-256 `39afd82b613d4e6146a15a9c8e48d01733597e45e26e594fdf3c57cc46c8ccd2`, which does **not** equal this revised template's SHA-256. The gate must FAIL until a separately approved upload of the revised bytes is read back and verified. Do not upload or mutate AWS as part of this change.

No AWS resource or policy change is made by committing these files. Applying any one-shot IAM policy, using AWS read preflight, uploading artifacts, or creating a stack requires a separate human decision.
