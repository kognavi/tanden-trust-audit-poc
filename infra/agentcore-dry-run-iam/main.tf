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
  description = "AWS Region containing the AgentCore demo stack."
  type        = string
  default     = "ap-northeast-1"
}

variable "github_actions_role_name" {
  description = "Existing GitHub Actions OIDC role to extend with read-only dry-run permission."
  type        = string
  default     = "gh-actions-tanden-audit-poc"
}

variable "agentcore_stack_name" {
  description = "CloudFormation stack name inspected by AgentCore CLI plan mode."
  type        = string
  default     = "AgentCore-TandenEvidenceDemo-default"
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_iam_role" "github_actions" {
  name = var.github_actions_role_name
}

data "aws_iam_policy_document" "agentcore_dry_run_read" {
  statement {
    sid     = "DescribeAgentCoreDemoStack"
    effect  = "Allow"
    actions = ["cloudformation:DescribeStacks"]

    resources = [
      "arn:aws:cloudformation:${var.aws_region}:${data.aws_caller_identity.current.account_id}:stack/${var.agentcore_stack_name}/*"
    ]
  }
}

resource "aws_iam_role_policy" "agentcore_dry_run_read" {
  name   = "agentcore-dry-run-read"
  role   = data.aws_iam_role.github_actions.name
  policy = data.aws_iam_policy_document.agentcore_dry_run_read.json
}
