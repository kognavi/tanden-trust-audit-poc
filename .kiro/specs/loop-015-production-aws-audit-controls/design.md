# loop-015-production-aws-audit-controls Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls`

## Current State

現行repoはEvidence処理の`Schema → Sign → Store → Ledger`順序、AWS KMS signing、S3 conditional write、S3 WORMとKMS keyのTerraformを持つ。一方、AWS API activityを保存するdedicated trail、Evidence object data events、CloudTrail log protection、security-sensitive control-plane変更のnotification pathはない。既存AWS documentsはこれらをtargetとして説明するだけで、deployed stateは保証しない。

## Proposed Design

### Separation of planes

- Evidence plane: existing application、Evidence bucket、KMS signing key、PostgreSQL Ledger。変更しない。
- Audit record plane: new multi-Region CloudTrailとdedicated S3 log bucket。
- Detection plane: EventBridge rules。
- Notification boundary: SNS topic without subscriptions。
- Deployment plane: Human-reviewed root configuration、plan、apply、post-deploy verification。今回のscope外。

### Terraform module

`infra/modules/production-aws-audit-controls/`へ`main.tf`、`variables.tf`、`outputs.tf`、`README.md`を追加する。moduleは既存environmentへ接続しないため、commitやtestだけではAWS resourceを作成しない。

AWS provider identity lookupに依存せず、`source_account_id`、`home_region`、`aws_partition`を明示inputとする。これによりvalidation/testでAWS credentialsを要求せず、bucket policy用trail ARNをdeterministically構築する。

`home_region`はinherited AWS provider Regionと一致させることをdeployment preconditionとする。不一致の場合、構築したtrail ARNと実際のtrail ARNが異なり、log bucket policyの`aws:SourceArn`によりdeliveryが拒否され得るため、environment bindingとsaved plan reviewで確認する。

### Audit log bucket

- dedicated bucket, `force_destroy`なし
- Versioning enabled
- SSE-S3 (`AES256`) to avoid new KMS key/key policy
- BucketOwnerEnforced ownership
- all public access blocked
- TLS-only explicit deny for bucket and objects
- CloudTrail `GetBucketAcl` and `PutObject` only, constrained by `aws:SourceArn`, `aws:SourceAccount`, expected account log prefix, and `bucket-owner-full-control`
- current/noncurrent log expiration using bounded `log_retention_days`

Object Lockはretention/legal/recovery approvalが未解決のためこのLoopでは使わない。log file validation、Versioning、no-force-destroy、control-change alertsはdetective baselineであり、privileged actorへの完全なimmutabilityではない。

### CloudTrail

- `is_multi_region_trail = true`
- `include_global_service_events = true`
- `enable_log_file_validation = true`
- `enable_logging = true`
- `read_write_type = "All"`
- `include_management_events = true`
- `exclude_management_event_sources = []`
- S3 object data resourceは`${var.evidence_bucket_arn}/`だけ

Trailはdedicated bucket policyへdepends onし、CloudTrail LakeやCloudWatch Logs integrationは追加しない。

### Detection and notification

EventBridgeの`AWS API Call via CloudTrail`を5 rulesへ分類する。

1. CloudTrail integrity: `StopLogging`, `DeleteTrail`, `UpdateTrail`, `PutEventSelectors`, `PutInsightSelectors`。
2. KMS administration: `DisableKey`, `ScheduleKeyDeletion`, `PutKeyPolicy`, `CreateGrant`, `RetireGrant`, `RevokeGrant`, alias mutation。
3. Protected S3 controls: bucket policy/public access/Versioning/Object Lock/lifecycle changes。`requestParameters.bucketName`をEvidence bucketとCloudTrail log bucketへ限定する。
4. IAM privilege changes: inline/managed policy attachment/version、role trust policy、role creation/deletion。account-wide low-volume control-plane eventsとして扱う。
5. Notification path integrity: EventBridge ruleの無効化・削除・target除去、およびSNS topic削除・attribute変更。

各ruleは同一SNS topicをtargetとする。SNS topic policyは`events.amazonaws.com`に`aws:SourceAccount`とcreated rule ARN条件付き`Publish`だけを許可する。subscriptionは定義しない。

## Affected Components

- `infra/modules/production-aws-audit-controls/main.tf`
- `infra/modules/production-aws-audit-controls/variables.tf`
- `infra/modules/production-aws-audit-controls/outputs.tf`
- `infra/modules/production-aws-audit-controls/README.md`
- `tests/production-aws-audit-controls.test.js`
- `docs/production-aws-audit-controls.md`
- `docs/aws-reference-architecture.md`
- `docs/roadmap.md`
- `knowledge/00-inbox/loop-015-production-aws-audit-controls.md`
- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md`
- `knowledge/30-learnings/loop-015-production-aws-audit-controls.md`
- `.kiro/specs/loop-015-production-aws-audit-controls/`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged。
- new Terraform/control docsはこのflowをobserveするAWS control planeであり、application module import、Schema/Sign/Store/Ledger call、Evidence serializationを変更しない。
- CloudTrail/SNS eventはoperational metadataであり、canonical EvidenceまたはLedger eventとして自動取り込みしない。

## Security

- IAM / KMS impact: live impactなし。IAM/KMS resourceやexisting policy codeを変更しない。SNS resource policyだけをnew module内で定義する。
- Secret / PII impact: Evidence body、signature、credential、raw prompt/responseを追加しない。EventBridge eventsはselected administrative API metadataに限定する。
- Auditability impact: management events、resource-scoped Evidence S3 data events、CloudTrail log validation、control-change notification pathをcodeとして再現可能にする。
- Residual risk: same-account privileged adminはtrail/bucket/topic/rulesを変更できる。cross-account organization trail、Object Lock archive、SCPは後続architecture decisionが必要。
- Independent Security Reviewer: required。

## Cost and Operations

- AWS resource impact: repository codeだけ。将来apply時はCloudTrail、S3 bucket、EventBridge rules、SNS topicが作成される。
- Recurring cost impact: S3 storage/request、CloudTrail S3 data events、SNS/EventBridge deliveryが従量課金。management event copyの既存trail重複やdata-event volume次第で増えるためplan前に既存trail調査が必要。
- Operational burden: retention、notification subscriber、false-positive tuning、trail health、digest validation、incident ownershipをHumanが決定する。
- Destructive risk: versioned log bucketは削除が難しい。`force_destroy`を使わず、destroy/retention shorteningはHuman Approval対象とする。

## Alternatives Considered

- CloudWatch Logs metric filters: deferred。CloudTrail delivery IAM role、log group retention、追加ingestion costが必要。volume anomalyは将来の価値があるがfirst baselineを広げる。
- AWS Config / Security Hub / GuardDuty: deferred。account-wide prerequisites、費用、ownershipがこのmodule scopeを超える。
- CloudTrail Lake: rejected for this Loop。query価値はあるが継続costと別retention modelを追加する。
- CloudTrail log Object Lock: deferred。stronger immutabilityは有益だが、retention/legal/recovery decisionなしに不可逆性を導入しない。
- SSE-KMS for trail logs: deferred。new encryption key policyまたはexisting key policy changeが必要で、userのKMS change approval boundaryと衝突する。
- existing S3 WORM bucketへCloudTrail logsを混在: rejected。Evidence artifactsとAWS audit logsのadministrative boundaryを分離する。

## Validation Plan

- Existing tests: `npm run check:structure`。
- New tests: Terraform filesをread-onlyで解析し、critical properties、event names、scope constraints、resource absences、docs approval wordingをassertする。
- Terraform: CLI availabilityを確認し、存在する場合のみ`terraform fmt -check`とoffline `terraform validate`。`plan`/`apply`は実行しない。
- Security checks: no live AWS call、no environment instantiation、no IAM/KMS resource、no subscriptions、no `force_destroy`、no wildcard S3 data-event resource、no secret/account/bucket hard-code。
- Governance: Spec Readiness → Handoff → Work bootstrap → Builder → Reviewer → Security Reviewer → Verification。

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests/module registry.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Existing resources and live mutations are separated from new control-plane code.
- [x] Security Reviewer is mandatory and independent from Builder.
- [x] Human Approval is explicit for merge, deploy, apply, IAM/KMS/retention/subscription/destructive changes.
