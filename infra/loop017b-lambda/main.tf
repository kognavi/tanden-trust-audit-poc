terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  description = "The Lambda and Bedrock inference-profile source Region."
  type        = string
  default     = "ap-northeast-1"

  validation {
    condition     = var.aws_region == "ap-northeast-1"
    error_message = "Loop 017B is limited to ap-northeast-1."
  }
}

variable "aws_account_id" {
  description = "Reviewed account containing the Loop 017B Lambda."
  type        = string
  default     = "270887329967"

  validation {
    condition     = var.aws_account_id == "270887329967"
    error_message = "Loop 017B account must match the reviewed account."
  }
}

variable "lambda_zip_path" {
  description = "Absolute path to the reviewed local Lambda ZIP; its SHA-256 must be approved before apply."
  type        = string
}

provider "aws" {
  region = var.aws_region
}

locals {
  function_name = "tanden-loop017b-nova"
  log_group     = "/aws/lambda/${local.function_name}"
  profile_arn   = "arn:aws:bedrock:${var.aws_region}:${var.aws_account_id}:inference-profile/jp.amazon.nova-2-lite-v1:0"
  model_arns = [
    "arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-2-lite-v1:0",
    "arn:aws:bedrock:ap-northeast-3::foundation-model/amazon.nova-2-lite-v1:0",
  ]
  tags = {
    Project = "Tanden"
    Loop    = "017B"
    Purpose = "temporary-live-evidence-demo"
  }
}

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    sid     = "LambdaOnly"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name               = "TandenLoop017BLambdaExecutionRole"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
  tags               = local.tags
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid       = "InvokeOnlyNova2LiteJapanProfile"
    effect    = "Allow"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.profile_arn]
  }

  statement {
    sid       = "InvokeOnlyModelsThroughJapanProfile"
    effect    = "Allow"
    actions   = ["bedrock:InvokeModel"]
    resources = local.model_arns

    condition {
      test     = "StringEquals"
      variable = "bedrock:InferenceProfileArn"
      values   = [local.profile_arn]
    }
  }

  statement {
    sid     = "WriteOnlyLoop017BLambdaLogs"
    effect  = "Allow"
    actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${local.log_group}:log-stream:*"
    ]
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name   = "Loop017BLambdaMinimalPermissions"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = local.log_group
  retention_in_days = 7
  tags              = local.tags
}

# Intentional Loop 017B one-shot PoC exception: no automatic triggers.
# Evidence correlation uses sanitized request IDs, CloudWatch Logs and CloudTrail.
# Reassess before reuse, automatic triggers or production use.
# nosemgrep: terraform.aws.security.aws-lambda-x-ray-tracing-not-active.aws-lambda-x-ray-tracing-not-active
resource "aws_lambda_function" "nova_demo" {
  function_name    = local.function_name
  role             = aws_iam_role.lambda_execution.arn
  runtime          = "nodejs22.x"
  handler          = "lambda/loop017b/handler.handler"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  memory_size      = 128
  timeout          = 90
  tags             = local.tags

  environment {
    variables = {
      LOOP017B_CODE_SHA256 = filesha256(var.lambda_zip_path)
    }
  }

  depends_on = [aws_iam_role_policy.lambda_permissions, aws_cloudwatch_log_group.lambda]
}

output "lambda_function_arn" {
  value = aws_lambda_function.nova_demo.arn
}

output "lambda_execution_role_arn" {
  value = aws_iam_role.lambda_execution.arn
}

output "lambda_log_group" {
  value = aws_cloudwatch_log_group.lambda.name
}
