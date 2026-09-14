terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}

locals {
  trail_name           = "${var.project_name}-trail"
  trail_arn            = "arn:${var.aws_partition}:cloudtrail:${var.home_region}:${var.source_account_id}:trail/${local.trail_name}"
  evidence_bucket_name = trimprefix(var.evidence_bucket_arn, "arn:${var.aws_partition}:s3:::")
  log_key_prefix       = "cloudtrail"
  cloudtrail_log_arn   = "${aws_s3_bucket.audit_logs.arn}/${local.log_key_prefix}/AWSLogs/${var.source_account_id}/*"

  common_tags = merge(var.tags, {
    Project   = var.project_name
    Purpose   = "production-audit-controls"
    ManagedBy = "terraform"
  })

  audit_event_patterns = {
    cloudtrail-integrity = {
      source      = ["aws.cloudtrail"]
      detail-type = ["AWS API Call via CloudTrail"]
      detail = {
        eventSource = ["cloudtrail.amazonaws.com"]
        eventName = [
          "StopLogging",
          "DeleteTrail",
          "UpdateTrail",
          "PutEventSelectors",
          "PutInsightSelectors"
        ]
      }
    }
    kms-administration = {
      source      = ["aws.kms"]
      detail-type = ["AWS API Call via CloudTrail"]
      detail = {
        eventSource = ["kms.amazonaws.com"]
        eventName = [
          "DisableKey",
          "EnableKey",
          "ScheduleKeyDeletion",
          "CancelKeyDeletion",
          "PutKeyPolicy",
          "CreateGrant",
          "RetireGrant",
          "RevokeGrant",
          "ImportKeyMaterial",
          "DeleteImportedKeyMaterial",
          "CreateAlias",
          "UpdateAlias",
          "DeleteAlias"
        ]
      }
    }
    protected-s3-controls = {
      source      = ["aws.s3"]
      detail-type = ["AWS API Call via CloudTrail"]
      detail = {
        eventSource = ["s3.amazonaws.com"]
        eventName = [
          "PutBucketPolicy",
          "DeleteBucketPolicy",
          "PutBucketPublicAccessBlock",
          "DeleteBucketPublicAccessBlock",
          "PutBucketVersioning",
          "PutBucketObjectLockConfiguration",
          "PutBucketLifecycle",
          "PutBucketLifecycleConfiguration",
          "DeleteBucketLifecycle"
        ]
        requestParameters = {
          bucketName = [local.evidence_bucket_name, var.log_bucket_name]
        }
      }
    }
    notification-path-integrity = {
      source      = ["aws.events", "aws.sns"]
      detail-type = ["AWS API Call via CloudTrail"]
      detail = {
        eventSource = ["events.amazonaws.com", "sns.amazonaws.com"]
        eventName = [
          "DisableRule",
          "DeleteRule",
          "PutRule",
          "PutTargets",
          "RemoveTargets",
          "DeleteTopic",
          "SetTopicAttributes",
          "Subscribe",
          "Unsubscribe",
          "AddPermission",
          "RemovePermission"
        ]
      }
    }
    iam-privilege-changes = {
      source      = ["aws.iam"]
      detail-type = ["AWS API Call via CloudTrail"]
      detail = {
        eventSource = ["iam.amazonaws.com"]
        eventName = [
          "PutRolePolicy",
          "DeleteRolePolicy",
          "AttachRolePolicy",
          "DetachRolePolicy",
          "PutUserPolicy",
          "DeleteUserPolicy",
          "AttachUserPolicy",
          "DetachUserPolicy",
          "PutGroupPolicy",
          "DeleteGroupPolicy",
          "AttachGroupPolicy",
          "DetachGroupPolicy",
          "CreatePolicy",
          "DeletePolicy",
          "CreatePolicyVersion",
          "SetDefaultPolicyVersion",
          "DeletePolicyVersion",
          "UpdateAssumeRolePolicy",
          "CreateRole",
          "DeleteRole"
        ]
      }
    }
  }
}

resource "aws_s3_bucket" "audit_logs" {
  bucket = var.log_bucket_name
  tags   = local.common_tags

  lifecycle {
    precondition {
      condition     = var.log_bucket_name != local.evidence_bucket_name
      error_message = "log_bucket_name must be separate from the Evidence bucket."
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "expire-audit-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.log_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.log_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_logs]
}

data "aws_iam_policy_document" "audit_log_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.audit_logs.arn,
      "${aws_s3_bucket.audit_logs.arn}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid    = "AllowCloudTrailAclCheck"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.audit_logs.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.source_account_id]
    }
  }

  statement {
    sid    = "AllowCloudTrailLogDelivery"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:PutObject"]
    resources = [local.cloudtrail_log_arn]

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.source_account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  policy = data.aws_iam_policy_document.audit_log_bucket.json
}

resource "aws_cloudtrail" "audit" {
  name                          = local.trail_name
  s3_bucket_name                = aws_s3_bucket.audit_logs.id
  s3_key_prefix                 = local.log_key_prefix
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  enable_logging                = true

  event_selector {
    read_write_type                  = "All"
    include_management_events        = true
    exclude_management_event_sources = []

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${var.evidence_bucket_arn}/"]
    }
  }

  tags = local.common_tags

  lifecycle {
    precondition {
      condition     = startswith(var.evidence_bucket_arn, "arn:${var.aws_partition}:s3:::")
      error_message = "evidence_bucket_arn must use the configured aws_partition."
    }
  }

  depends_on = [
    aws_s3_bucket_policy.audit_logs,
    aws_s3_bucket_ownership_controls.audit_logs,
    aws_s3_bucket_public_access_block.audit_logs,
    aws_s3_bucket_server_side_encryption_configuration.audit_logs,
    aws_s3_bucket_versioning.audit_logs
  ]
}

resource "aws_sns_topic" "security_notifications" {
  name = "${var.project_name}-security-notifications"
  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "security_controls" {
  for_each = local.audit_event_patterns

  name          = "${var.project_name}-${each.key}"
  description   = "Detect ${each.key} API activity for audit review."
  event_pattern = jsonencode(each.value)
  state         = "ENABLED"
  tags          = local.common_tags
}

resource "aws_cloudwatch_event_target" "security_notifications" {
  for_each = aws_cloudwatch_event_rule.security_controls

  rule = each.value.name
  arn  = aws_sns_topic.security_notifications.arn
}

data "aws_iam_policy_document" "security_notifications" {
  statement {
    sid    = "AllowEventBridgeRulesOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.security_notifications.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.source_account_id]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [for rule in aws_cloudwatch_event_rule.security_controls : rule.arn]
    }
  }
}

resource "aws_sns_topic_policy" "security_notifications" {
  arn    = aws_sns_topic.security_notifications.arn
  policy = data.aws_iam_policy_document.security_notifications.json
}
