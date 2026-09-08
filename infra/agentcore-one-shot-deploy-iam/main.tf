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
  description = "Dedicated CDK bootstrap qualifier for the Tanden one-shot PoC."
  type        = string
  default     = "tandenpoc"
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
  runtime_role_name   = "TandenEvidenceDemoRuntimeExecutionRole"
  runtime_role_arn    = "arn:aws:iam::${local.account_id}:role/${local.runtime_role_name}"
}

data "aws_iam_policy_document" "agentcore_cfn_execution" {
  statement {
    sid    = "CreateTaggedTandenRuntime"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:CreateAgentRuntime",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/Project"
      values   = ["tanden-trust-audit-poc"]
    }
  }

  statement {
    sid    = "ManageTaggedTandenRuntime"
    effect = "Allow"
    actions = [
      "bedrock-agentcore:GetAgentRuntime",
      "bedrock-agentcore:UpdateAgentRuntime",
      "bedrock-agentcore:DeleteAgentRuntime",
      "bedrock-agentcore:CreateAgentRuntimeEndpoint",
      "bedrock-agentcore:GetAgentRuntimeEndpoint",
      "bedrock-agentcore:UpdateAgentRuntimeEndpoint",
      "bedrock-agentcore:DeleteAgentRuntimeEndpoint",
      "bedrock-agentcore:ListTagsForResource",
    ]
    resources = [
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:runtime/*",
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:runtime/*/runtime-endpoint/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = ["tanden-trust-audit-poc"]
    }
  }

  statement {
    sid     = "TagOnlyTandenRuntimeResources"
    effect  = "Allow"
    actions = ["bedrock-agentcore:TagResource"]
    resources = [
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:runtime/*",
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:runtime/*/runtime-endpoint/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/Project"
      values   = ["tanden-trust-audit-poc"]
    }
  }

  statement {
    sid     = "DeleteRuntimeWorkloadIdentity"
    effect  = "Allow"
    actions = ["bedrock-agentcore:DeleteWorkloadIdentity"]
    resources = [
      "arn:aws:bedrock-agentcore:${var.aws_region}:${local.account_id}:workload-identity-directory/default/workload-identity/*"
    ]
  }

  statement {
    sid    = "ManageOnlyTandenRuntimeExecutionRole"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:GetRole",
      "iam:DeleteRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRoleDescription",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
    ]
    resources = [local.runtime_role_arn]
  }

  statement {
    sid     = "PassOnlyTandenRuntimeRoleToAgentCore"
    effect  = "Allow"
    actions = ["iam:PassRole"]
    resources = [local.runtime_role_arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["bedrock-agentcore.amazonaws.com"]
    }
  }

  statement {
    sid     = "CreateOnlyAgentCoreRuntimeIdentityServiceLinkedRole"
    effect  = "Allow"
    actions = ["iam:CreateServiceLinkedRole"]
    resources = [
      "arn:aws:iam::${local.account_id}:role/aws-service-role/runtime-identity.bedrock-agentcore.amazonaws.com/AWSServiceRoleForBedrockAgentCoreRuntimeIdentity"
    ]

    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["runtime-identity.bedrock-agentcore.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "agentcore_cfn_execution" {
  name        = "TandenAgentCoreCfnExecution"
  description = "Least-privilege CloudFormation execution policy for the one-shot Tanden AgentCore Runtime stack."
  policy      = data.aws_iam_policy_document.agentcore_cfn_execution.json

  tags = {
    Project   = "tanden-trust-audit-poc"
    Purpose   = "agentcore-cfn-execution"
    ManagedBy = "terraform"
  }
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

output "agentcore_cfn_execution_policy_arn" {
  description = "Pass this ARN to cdk bootstrap --cloudformation-execution-policies."
  value       = aws_iam_policy.agentcore_cfn_execution.arn
}
