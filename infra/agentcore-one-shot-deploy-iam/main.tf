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
  description = "AWS Region for the one-shot AgentCore demo."
  type        = string
  default     = "ap-northeast-1"
}

variable "github_org" {
  type    = string
  default = "kognavi"
}

variable "github_repo" {
  type    = string
  default = "tanden-trust-audit-poc"
}

variable "cdk_qualifier" {
  description = "CDK bootstrap qualifier. Default is the standard modern-bootstrap qualifier."
  type        = string
  default     = "hnb659fds"
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  account_id        = data.aws_caller_identity.current.account_id
  oidc_provider_arn = "arn:aws:iam::${local.account_id}:oidc-provider/token.actions.githubusercontent.com"

  agentcore_stack_name = "AgentCore-TandenEvidenceDemo-default"
  agentcore_stack_arn  = "arn:aws:cloudformation:${var.aws_region}:${local.account_id}:stack/${local.agentcore_stack_name}/*"
  cdktoolkit_stack_arn = "arn:aws:cloudformation:${var.aws_region}:${local.account_id}:stack/CDKToolkit/*"

  cdk_deploy_role_arn = "arn:aws:iam::${local.account_id}:role/cdk-${var.cdk_qualifier}-deploy-role-${local.account_id}-${var.aws_region}"
  cdk_file_role_arn   = "arn:aws:iam::${local.account_id}:role/cdk-${var.cdk_qualifier}-file-publishing-role-${local.account_id}-${var.aws_region}"
  cdk_lookup_role_arn = "arn:aws:iam::${local.account_id}:role/cdk-${var.cdk_qualifier}-lookup-role-${local.account_id}-${var.aws_region}"
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "agentcore_one_shot" {
  name                 = "gh-actions-tanden-agentcore-one-shot"
  description          = "Main-branch-only GitHub OIDC role for one-shot AgentCore deploy, invoke, and teardown."
  assume_role_policy   = data.aws_iam_policy_document.github_trust.json
  max_session_duration = 3600

  tags = {
    Project   = "tanden-trust-audit-poc"
    Purpose   = "agentcore-one-shot-deploy"
    ManagedBy = "terraform"
  }
}

data "aws_iam_policy_document" "agentcore_one_shot" {
  statement {
    sid     = "AssumeOnlyRequiredCdkBootstrapRoles"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    resources = [
      local.cdk_deploy_role_arn,
      local.cdk_file_role_arn,
      local.cdk_lookup_role_arn,
    ]
  }

  statement {
    sid       = "CallerIdentity"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }

  statement {
    sid     = "DescribeOnlyDemoAndBootstrapStacks"
    effect  = "Allow"
    actions = ["cloudformation:DescribeStacks"]
    resources = [
      local.agentcore_stack_arn,
      local.cdktoolkit_stack_arn,
    ]
  }

  statement {
    sid     = "ReadCdkBootstrapVersion"
    effect  = "Allow"
    actions = ["ssm:GetParameter"]
    resources = [
      "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/cdk-bootstrap/${var.cdk_qualifier}/version"
    ]
  }

  statement {
    sid    = "InvokeOnlyTaggedDemoRuntime"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:InvokeAgentRuntime",
      "bedrock-agentcore:GetAgentRuntime",
      "bedrock-agentcore:StopRuntimeSession",
    ]
    resources = [
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:runtime/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = ["tanden-trust-audit-poc"]
    }
  }
}

resource "aws_iam_role_policy" "agentcore_one_shot" {
  name   = "agentcore-one-shot-deploy"
  role   = aws_iam_role.agentcore_one_shot.id
  policy = data.aws_iam_policy_document.agentcore_one_shot.json
}

output "agentcore_one_shot_role_arn" {
  description = "Use this role for the gated one-shot deploy/invoke/teardown workflow."
  value       = aws_iam_role.agentcore_one_shot.arn
}
