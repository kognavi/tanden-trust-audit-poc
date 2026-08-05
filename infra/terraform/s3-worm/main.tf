# =====================================================================
# tanden-trust-audit-poc : S3 WORM (Write Once Read Many) Infrastructure
# =====================================================================
# 目的:
#   監査証跡（Evidence）を「一度書いたら二度と改ざん・削除できない」
#   状態でS3に保存するための、多層防御インフラをコード化する。
#
# 防御レイヤー構成:
#   ① アプリ層   : IfNoneMatch: "*" (S3 Conditional Writes) -- コード側で対応済み
#   ② インフラ層 : S3 Versioning + Object Lock (Compliance mode) -- 本ファイルで定義
#   ③ IAM層     : Deny policy (break-glassロール以外の削除操作を拒否)
#
# コスト注意:
#   - `terraform plan` は無料(ドライラン)
#   - `terraform apply` でバケット作成のみなら実質無料枠内
#   - Compliance modeで retention_days を長期(例:365)にしたまま
#     オブジェクトをPUTすると、保持期間終了までバケットを削除できない。
#     ポートフォリオ検証時は retention_days を短く(例:1)設定すること。

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------
# Variables
# -----------------------------------------------------------------
variable "aws_region" {
  description = "デプロイ先リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "bucket_name" {
  description = "監査証跡を保存するS3バケット名(グローバルで一意である必要あり)"
  type        = string
}

variable "retention_mode" {
  description = "Object Lockの保持モード。COMPLIANCEはrootでも削除不可、GOVERNANCEは特権IAMなら削除可"
  type        = string
  default     = "COMPLIANCE"

  validation {
    condition     = contains(["COMPLIANCE", "GOVERNANCE"], var.retention_mode)
    error_message = "retention_mode must be COMPLIANCE or GOVERNANCE."
  }
}

variable "retention_days" {
  description = "保持日数。本番は365*7(7年)等を想定。検証時は1などの短期値を推奨"
  type        = number
  default     = 1
}

variable "break_glass_role_arn" {
  description = "緊急時のみ削除操作を許可するIAMロールARN(通常運用では未使用)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------
# S3 Bucket (Object Lock対応バケットは作成時のみ有効化可能)
# -----------------------------------------------------------------
resource "aws_s3_bucket" "audit_trail" {
  bucket              = var.bucket_name
  object_lock_enabled = true

  tags = {
    Project   = "tanden-trust-audit-poc"
    Purpose   = "tamper-evident-audit-trail"
    ManagedBy = "terraform"
  }
}

# -----------------------------------------------------------------
# Versioning (Object Lockの前提条件)
# -----------------------------------------------------------------
resource "aws_s3_bucket_versioning" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  versioning_configuration {
    status = "Enabled"
  }
}

# -----------------------------------------------------------------
# Object Lock デフォルト保持ルール
# -----------------------------------------------------------------
resource "aws_s3_bucket_object_lock_configuration" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  rule {
    default_retention {
      mode = var.retention_mode
      days = var.retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_trail]
}

# -----------------------------------------------------------------
# デフォルト暗号化 (SSE-KMS: AWS管理キー alias/aws/s3 を使用)
# CMK(カスタマー管理キー)は月額$1発生するため使わず、
# AWS管理キーで無料枠内でKMS暗号化の要件を満たす
# -----------------------------------------------------------------
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3"
    }
    bucket_key_enabled = true
  }
}


# -----------------------------------------------------------------
# パブリックアクセスの完全ブロック (Well-Architected: セキュリティの柱)
# -----------------------------------------------------------------
resource "aws_s3_bucket_public_access_block" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------
# IAMポリシー: break-glassロール以外の削除操作を明示的に拒否
# -----------------------------------------------------------------
resource "aws_s3_bucket_policy" "deny_delete" {
  bucket = aws_s3_bucket.audit_trail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyDeleteObjectsExceptBreakGlass"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = "${aws_s3_bucket.audit_trail.arn}/*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = var.break_glass_role_arn != "" ? var.break_glass_role_arn : "arn:aws:iam::000000000000:role/never-matches"
          }
        }
      },
      {
        Sid       = "DenyBucketConfigChangeExceptBreakGlass"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:PutBucketObjectLockConfiguration",
          "s3:PutLifecycleConfiguration"
        ]
        Resource = aws_s3_bucket.audit_trail.arn
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = var.break_glass_role_arn != "" ? var.break_glass_role_arn : "arn:aws:iam::000000000000:role/never-matches"
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------
# ライフサイクル: 不完全なマルチパートアップロードの自動削除(コスト最適化)
# -----------------------------------------------------------------
resource "aws_s3_bucket_lifecycle_configuration" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  rule {
    id     = "abort-incomplete-multipart-upload"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# =====================================================================
# アクセスログ保管用バケット (audit_trailへの操作履歴を記録)
# 2022年以降のベストプラクティス: ACLではなくバケットポリシーで
# S3ログ配信サービスに権限を付与する方式を採用
# =====================================================================
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "audit_trail_logs" {
  bucket = "${var.bucket_name}-access-logs"

  tags = {
    Project   = "tanden-trust-audit-poc"
    Purpose   = "access-log-storage"
    ManagedBy = "terraform"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_trail_logs" {
  bucket = aws_s3_bucket.audit_trail_logs.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3"
    }
  }
}


resource "aws_s3_bucket_public_access_block" "audit_trail_logs" {
  bucket = aws_s3_bucket.audit_trail_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "audit_trail_logs" {
  bucket = aws_s3_bucket.audit_trail_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "S3ServerAccessLogsPolicy"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.audit_trail_logs.arn}/access-logs/*"
        Condition = {
          ArnLike = {
            "aws:SourceArn" = aws_s3_bucket.audit_trail.arn
          }
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_trail_logs" {
  bucket = aws_s3_bucket.audit_trail_logs.id

  rule {
    id     = "expire-old-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_logging" "audit_trail" {
  bucket        = aws_s3_bucket.audit_trail.id
  target_bucket = aws_s3_bucket.audit_trail_logs.id
  target_prefix = "access-logs/"

  depends_on = [aws_s3_bucket_policy.audit_trail_logs]
}

# -----------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------
output "bucket_name" {
  value = aws_s3_bucket.audit_trail.id
}

output "bucket_arn" {
  value = aws_s3_bucket.audit_trail.arn
}

output "object_lock_mode" {
  value = var.retention_mode
}
