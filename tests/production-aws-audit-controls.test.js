const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");
const moduleRoot = path.join(repositoryRoot, "infra/modules/production-aws-audit-controls");

const read = (name) => fs.readFileSync(path.join(moduleRoot, name), "utf8");

const main = read("main.tf");
const variables = read("variables.tf");
const outputs = read("outputs.tf");
const moduleReadme = read("README.md");
const operationsRunbook = fs.readFileSync(
  path.join(repositoryRoot, "docs/production-aws-audit-controls.md"),
  "utf8"
);

test("production audit module remains standalone and cannot run during existing PoC apply", () => {
  const environmentRoot = fs.readFileSync(
    path.join(repositoryRoot, "infra/environments/poc/main.tf"),
    "utf8"
  );
  const legacyIntegrationRoot = fs.readFileSync(
    path.join(repositoryRoot, "infra/terraform-github-oidc-s3.tf"),
    "utf8"
  );

  assert.doesNotMatch(environmentRoot, /production-aws-audit-controls/);
  assert.doesNotMatch(legacyIntegrationRoot, /production-aws-audit-controls/);
  assert.match(moduleReadme, /intentionally not instantiated/);
  assert.doesNotMatch(main, /force_destroy\s*=/);
});

test("CloudTrail captures multi-Region management and Evidence-bucket data events", () => {
  assert.match(main, /resource "aws_cloudtrail" "audit"/);
  assert.match(main, /is_multi_region_trail\s*=\s*true/);
  assert.match(main, /include_global_service_events\s*=\s*true/);
  assert.match(main, /enable_log_file_validation\s*=\s*true/);
  assert.match(main, /enable_logging\s*=\s*true/);
  assert.match(main, /read_write_type\s*=\s*"All"/);
  assert.match(main, /include_management_events\s*=\s*true/);
  assert.match(main, /exclude_management_event_sources\s*=\s*\[\]/);
  assert.match(main, /type\s*=\s*"AWS::S3::Object"/);
  assert.match(main, /values\s*=\s*\["\$\{var\.evidence_bucket_arn\}\/"\]/);
  assert.doesNotMatch(main, /arn:[^"\n]*:s3:::\*\/|values\s*=\s*\["arn:[^"\n]*:s3:::\/"\]/);
});

test("dedicated CloudTrail log bucket has the required protection baseline", () => {
  assert.match(main, /resource "aws_s3_bucket" "audit_logs"/);
  assert.match(main, /object_ownership\s*=\s*"BucketOwnerEnforced"/);
  assert.match(main, /status\s*=\s*"Enabled"/);
  assert.match(main, /sse_algorithm\s*=\s*"AES256"/);
  for (const setting of [
    "block_public_acls",
    "block_public_policy",
    "ignore_public_acls",
    "restrict_public_buckets"
  ]) {
    assert.match(main, new RegExp(`${setting}\\s*=\\s*true`));
  }
  assert.match(main, /sid\s*=\s*"DenyInsecureTransport"/);
  assert.match(main, /variable\s*=\s*"aws:SecureTransport"/);
  assert.match(main, /identifiers\s*=\s*\["cloudtrail\.amazonaws\.com"\]/);
  assert.match(main, /variable\s*=\s*"aws:SourceArn"/);
  assert.match(main, /variable\s*=\s*"aws:SourceAccount"/);
  assert.match(main, /variable\s*=\s*"s3:x-amz-acl"/);
  assert.match(main, /values\s*=\s*\["bucket-owner-full-control"\]/);
  assert.match(main, /noncurrent_version_expiration/);
});

test("home-Region EventBridge rules cover the five reviewed security-control classes", () => {
  for (const ruleName of [
    "cloudtrail-integrity",
    "kms-administration",
    "protected-s3-controls",
    "notification-path-integrity",
    "iam-privilege-changes"
  ]) {
    assert.match(main, new RegExp(`${ruleName}\\s*=\\s*\\{`));
  }

  for (const eventName of [
    "StopLogging",
    "DeleteTrail",
    "PutEventSelectors",
    "DisableKey",
    "ScheduleKeyDeletion",
    "PutKeyPolicy",
    "CreateGrant",
    "PutBucketPolicy",
    "PutBucketVersioning",
    "PutBucketPublicAccessBlock",
    "PutBucketObjectLockConfiguration",
    "AttachRolePolicy",
    "CreatePolicyVersion",
    "UpdateAssumeRolePolicy"
  ]) {
    assert.match(main, new RegExp(`"${eventName}"`));
  }

  assert.match(main, /bucketName\s*=\s*\[local\.evidence_bucket_name, var\.log_bucket_name\]/);
  for (const notificationPathEvent of [
    "DisableRule",
    "PutTargets",
    "RemoveTargets",
    "DeleteTopic",
    "SetTopicAttributes",
    "Subscribe",
    "Unsubscribe",
    "AddPermission",
    "RemovePermission"
  ]) {
    assert.match(main, new RegExp(`"${notificationPathEvent}"`));
  }
  assert.match(main, /resource "aws_cloudwatch_event_target" "security_notifications"/);
  assert.match(main, /input_transformer\s*\{/);
  assert.match(main, /event_id\s*=\s*"\$\.detail\.eventID"/);
  assert.doesNotMatch(main, /event_id\s*=\s*"\$\.id"/);
  assert.match(main, /event_name\s*=\s*"\$\.detail\.eventName"/);
  assert.match(main, /input_template\s*=\s*<<-EOT/);
  assert.doesNotMatch(main, /input_paths\s*=\s*\{[^}]*requestParameters/s);
  assert.doesNotMatch(main, /input_paths\s*=\s*\{[^}]*userIdentity/s);
  assert.match(main, /resource "aws_sns_topic_policy" "security_notifications"/);
  assert.match(main, /identifiers\s*=\s*\["events\.amazonaws\.com"\]/);
  assert.match(main, /actions\s*=\s*\["sns:Publish"\]/);
  assert.match(main, /values\s*=\s*\[for rule in aws_cloudwatch_event_rule\.security_controls : rule\.arn\]/);
});

test("module introduces no IAM/KMS resources, subscriber, or account-wide security service", () => {
  assert.doesNotMatch(main, /resource "aws_iam_/);
  assert.doesNotMatch(main, /resource "aws_kms_/);
  assert.doesNotMatch(main, /resource "aws_sns_topic_subscription"/);
  assert.doesNotMatch(main, /resource "aws_config_/);
  assert.doesNotMatch(main, /resource "aws_securityhub_/);
  assert.doesNotMatch(main, /resource "aws_guardduty_/);
  assert.doesNotMatch(main, /resource "aws_cloudtrail_event_data_store"/);
});

test("inputs and outputs expose a validated, non-secret deployment contract", () => {
  for (const variableName of [
    "source_account_id",
    "home_region",
    "aws_partition",
    "evidence_bucket_arn",
    "log_bucket_name",
    "log_retention_days"
  ]) {
    assert.match(variables, new RegExp(`variable "${variableName}"`));
  }
  assert.match(variables, /\^\[0-9\]\{12\}\$/);
  assert.match(variables, /var\.log_retention_days >= 30/);
  assert.match(variables, /var\.log_retention_days <= 3653/);
  assert.match(main, /startswith\(var\.evidence_bucket_arn, "arn:\$\{var\.aws_partition\}:s3:::"\)/);
  assert.match(main, /var\.log_bucket_name != local\.evidence_bucket_name/);

  for (const outputName of [
    "trail_name",
    "trail_arn",
    "log_bucket_name",
    "log_bucket_arn",
    "notification_topic_arn",
    "event_rule_arns"
  ]) {
    assert.match(outputs, new RegExp(`output "${outputName}"`));
  }
  assert.doesNotMatch(outputs, /sensitive\s*=\s*false|credential|secret/i);
});

test("documentation preserves Human Approval and current-versus-deployed truth", () => {
  assert.match(operationsRunbook, /not deployed or verified in a live AWS account/i);
  assert.match(operationsRunbook, /Evidence → Schema → Sign → Store → Ledger/);
  assert.match(operationsRunbook, /explicit Human Approval/i);
  assert.match(operationsRunbook, /S3 data events are charged/i);
  assert.match(operationsRunbook, /does not prove/i);
  assert.match(operationsRunbook, /home_region.*inherited AWS provider Region/i);
  assert.match(operationsRunbook, /EventBridge rules are Regional/i);
  assert.match(operationsRunbook, /does not claim account-wide active detection/i);
  assert.match(moduleReadme, /home_region.*inherited AWS provider Region/i);
  assert.match(moduleReadme, /does not provide multi-Region active alerting/i);
  assert.match(moduleReadme, /Do not run `terraform plan` or `terraform apply` as part of default CI/);
});
