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
#
# 設計ノート(2026-08-19):
#   本モジュールは呼び出し元(infra/environments/poc等)からproviderが
#   供給されることを前提とする。再利用可能モジュール内でprovider
#   ブロックを直接宣言しない(kms-signingモジュールと同じ規約)。

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
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
# デフォルト暗号化 (SSE-S3: AES256、KMS CMKは月額$1発生するため回避)
# -----------------------------------------------------------------
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_trail" {
  bucket = aws_s3_bucket.audit_trail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
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
        Sid       = "DenyDeleteExceptBreakGlass"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion",
          "s3:PutBucketObjectLockConfiguration",
          "s3:PutLifecycleConfiguration"
        ]
        Resource = "${aws_s3_bucket.audit_trail.arn}/*"
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
