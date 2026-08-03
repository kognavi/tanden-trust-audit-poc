# =====================================================================
# terraform-github-oidc-s3.tf
# GitHub Actions → AWS S3 を OIDC（一時クレデンシャル）で連携するための構成
# 対象リポジトリ: tanden-trust-audit-poc
# =====================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------
# 変数定義
# ---------------------------------------------------------------------

variable "aws_region" {
  description = "デプロイ先リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "github_org" {
  description = "GitHub organization / user名"
  type        = string
  default     = "kognavi"
}

variable "github_repo" {
  description = "GitHubリポジトリ名"
  type        = string
  default     = "tanden-trust-audit-poc"
}

variable "allowed_subjects" {
  description = <<-EOT
    IAMロールをAssumeできるGitHub OIDCの sub claim パターン一覧。
    まずは緩め(全ブランチ/PR許可)で動作確認し、慣れたら main + PR に絞り込む運用を推奨。
  EOT
  type    = list(string)
  default = [
    "repo:kognavi/tanden-trust-audit-poc:*"
  ]
}

variable "test_bucket_name" {
  description = "統合テスト専用S3バケット名（グローバルで一意である必要あり）"
  type        = string
  default     = "tanden-trust-audit-poc-test-bucket"
}

variable "create_oidc_provider" {
  description = <<-EOT
    trueの場合、新規にGitHub OIDC Providerを作成する。
    AWSアカウント内に既に token.actions.githubusercontent.com のOIDC Providerが
    存在する場合(他プロジェクトで作成済み等)はfalseにして既存ARNを var.existing_oidc_provider_arn に渡すこと。
    ※同一URLのOIDC ProviderはAWSアカウント内に1つしか作成できない制約があるため注意。
  EOT
  type    = bool
  default = true
}

variable "existing_oidc_provider_arn" {
  description = "create_oidc_provider = false の場合に使う既存OIDC ProviderのARN"
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------
# GitHub OIDC Provider
# ---------------------------------------------------------------------

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = {
    Project   = "tanden-trust-audit-poc"
    ManagedBy = "terraform"
    Purpose   = "github-actions-oidc"
  }
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn
}

# ---------------------------------------------------------------------
# IAMロール & 信頼ポリシー
# ---------------------------------------------------------------------

data "aws_iam_policy_document" "github_actions_trust" {
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
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.allowed_subjects
    }
  }
}

resource "aws_iam_role" "gh_actions_tanden_audit_poc" {
  name               = "gh-actions-tanden-audit-poc"
  description = "IAM role for GitHub Actions CI to run S3 integration tests via OIDC federation"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json

  max_session_duration = 3600 # 1時間。CIジョブの想定所要時間に応じて調整可

  tags = {
    Project   = "tanden-trust-audit-poc"
    ManagedBy = "terraform"
  }
}

# ---------------------------------------------------------------------
# IAM権限ポリシー（S3最小権限）
# ---------------------------------------------------------------------

data "aws_iam_policy_document" "s3_test_access" {
  statement {
    sid     = "ObjectReadWrite"
    effect  = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.test_bucket.arn}/*"]
  }

  statement {
    sid       = "BucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.test_bucket.arn]
  }
}

resource "aws_iam_role_policy" "s3_test_access" {
  name   = "s3-integration-test-access"
  role   = aws_iam_role.gh_actions_tanden_audit_poc.id
  policy = data.aws_iam_policy_document.s3_test_access.json
}

# ---------------------------------------------------------------------
# 統合テスト専用 S3 バケット
# (監査PoCの思想に合わせ、暗号化・バージョニング・パブリックアクセス遮断を徹底)
# ---------------------------------------------------------------------

resource "aws_s3_bucket" "test_bucket" {
  bucket        = var.test_bucket_name
  force_destroy = true # PoC用途のため許可。本番運用時は要見直し

  tags = {
    Project   = "tanden-trust-audit-poc"
    ManagedBy = "terraform"
    Purpose   = "ci-integration-test"
  }
}

resource "aws_s3_bucket_public_access_block" "test_bucket" {
  bucket = aws_s3_bucket.test_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "test_bucket" {
  bucket = aws_s3_bucket.test_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "test_bucket" {
  bucket = aws_s3_bucket.test_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

# コスト最適化: テストで生成されたオブジェクトは7日で自動削除
resource "aws_s3_bucket_lifecycle_configuration" "test_bucket" {
  bucket = aws_s3_bucket.test_bucket.id

  rule {
    id     = "expire-test-objects"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}

# ---------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------

output "oidc_provider_arn" {
  description = "GitHub OIDC ProviderのARN"
  value       = local.oidc_provider_arn
}

output "github_actions_role_arn" {
  description = "GitHub Actionsワークフローの role-to-assume に設定するARN"
  value       = aws_iam_role.gh_actions_tanden_audit_poc.arn
}

output "test_bucket_name" {
  description = "統合テスト用S3バケット名（TEST_BUCKET_NAME環境変数に設定）"
  value       = aws_s3_bucket.test_bucket.bucket
}