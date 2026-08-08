##################################################
# S3 Object Lock (WORM) 検証用 Terraform
# tanden-trust-audit-poc
#
# 目的: 証拠データストレージのWORM(Write Once Read Many)性を実証する
#
# 【重要】Object Lockはバケット作成時にのみ有効化可能。
#         既存バケットへの後付けは不可能（AWS仕様）。
#
# 【重要】COMPLIANCEモードは一度設定すると、保持期間中は
#         root権限でも削除・上書き・destroy不可になる。
#         検証時は retention_days を短く（1日）設定すること。
##################################################

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

##################################################
# Variables
##################################################

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "環境識別子（バケット名の一意性確保用）"
  type        = string
  default     = "poc"
}

variable "object_lock_mode" {
  description = <<-EOT
    Object Lockのモード:
    - GOVERNANCE: s3:BypassGovernanceRetention権限があれば削除・上書き可能
                  → 検証後にterraform destroyしたい場合はこちらを推奨
    - COMPLIANCE: 保持期間中はroot権限でも削除・上書き・destroy完全不可
                  → 真のWORM保証を検証するが、destroyできなくなるリスクあり
  EOT
  type        = string
  default     = "GOVERNANCE"

  validation {
    condition     = contains(["GOVERNANCE", "COMPLIANCE"], var.object_lock_mode)
    error_message = "object_lock_mode must be GOVERNANCE or COMPLIANCE."
  }
}

variable "retention_days" {
  description = "デフォルト保持期間（日数）。検証用なので最短の1日を推奨"
  type        = number
  default     = 1

  validation {
    condition     = var.retention_days >= 1
    error_message = "retention_days must be at least 1."
  }
}

##################################################
# ランダムサフィックス（バケット名の衝突防止・使い捨て運用）
##################################################

resource "random_id" "suffix" {
  byte_length = 4
}

##################################################
# S3 Bucket本体
##################################################

resource "aws_s3_bucket" "evidence_worm" {
  bucket = "tanden-audit-worm-${var.environment}-${random_id.suffix.hex}"

  object_lock_enabled = true

  tags = {
    Project     = "tanden-trust-audit-poc"
    Purpose     = "WORM-verification"
    Environment = var.environment
    ManagedBy   = "terraform"
    Lifecycle   = "temporary-do-not-forget-to-destroy"
  }
}

##################################################
# バージョニング（Object Lockの前提条件・必須）
##################################################

resource "aws_s3_bucket_versioning" "evidence_worm" {
  bucket = aws_s3_bucket.evidence_worm.id

  versioning_configuration {
    status = "Enabled"
  }
}

##################################################
# Object Lock設定（デフォルト保持ルール）
# 注意: versioningが有効化された後に適用する必要がある
##################################################

resource "aws_s3_bucket_object_lock_configuration" "evidence_worm" {
  bucket = aws_s3_bucket.evidence_worm.id

  rule {
    default_retention {
      mode = var.object_lock_mode
      days = var.retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.evidence_worm]
}

##################################################
# 暗号化設定（将来のKMSハイブリッド構成に拡張可能な設計）
##################################################

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_worm" {
  bucket = aws_s3_bucket.evidence_worm.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

##################################################
# パブリックアクセスブロック（証拠データ保護の基本セキュリティ）
##################################################

resource "aws_s3_bucket_public_access_block" "evidence_worm" {
  bucket = aws_s3_bucket.evidence_worm.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

##################################################
# Outputs
##################################################

output "bucket_name" {
  description = "作成されたWORMバケット名"
  value       = aws_s3_bucket.evidence_worm.id
}

output "bucket_arn" {
  description = "バケットARN"
  value       = aws_s3_bucket.evidence_worm.arn
}

output "object_lock_mode" {
  description = "設定されたObject Lockモード"
  value       = var.object_lock_mode
}

output "retention_days" {
  description = "設定された保持期間（日数）"
  value       = var.retention_days
}

output "cleanup_warning" {
  description = "後片付け時の注意事項"
  value       = var.object_lock_mode == "COMPLIANCE" ? "COMPLIANCEモードのため、retention_days(${var.retention_days}日)が経過するまでterraform destroyは失敗します。" : "GOVERNANCEモードのため、実行者にs3:BypassGovernanceRetention権限があればterraform destroy可能です。"
}