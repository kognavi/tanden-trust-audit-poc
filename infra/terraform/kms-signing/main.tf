# =====================================================================
# tanden-trust-audit-poc : KMS Asymmetric Signing Key Infrastructure
# =====================================================================
# 目的:
#   監査証跡(Evidence)の真正性を暗号学的に証明するための、
#   非対称署名鍵(KMS Asymmetric Key)をコード化する。
#
# 設計方針:
#   ① 鍵種別    : ECC_SECG_P256K1 (secp256k1曲線。Web3/Ethereum互換のため必須。RSAやECC_NIST_P256では不可)
#   ② 用途      : SIGN_VERIFY (KMS_SIGN_VERIFYオペレーションのみ許可)
#   ③ キーポリシー: 署名(Sign)は特定IAMロールのみ許可。検証(Verify)は
#                  公開鍵をエクスポートして誰でも検証可能にする設計も検討可
#   ④ ローテーション: 非対称鍵は自動ローテーション非対応のため、
#                    運用上は鍵バージョン管理(alias切替)で対応する方針
#
# コスト注意:
#   - KMSキー: $1/月(常時課金、リージョンごと)
#   - API呼び出し: Sign/Verify 1万回あたり$0.03程度(GenerateDataKeyより高め)
#   - ポートフォリオ検証時は検証後に確実に鍵を削除(pending deletion)すること
# =====================================================================

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

data "aws_caller_identity" "current" {}

# -----------------------------------------------------------------
# Variables
# -----------------------------------------------------------------
variable "aws_region" {
  description = "デプロイ先リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "key_alias_name" {
  description = "KMSキーのエイリアス名(alias/を除いた部分)"
  type        = string
}

variable "signing_algorithm" {
  description = "署名アルゴリズム(RSASSA_PKCS1_V1_5_SHA_256 等)"
  type        = string
  default     = "ECDSA_SHA_256"
}

variable "customer_master_key_spec" {
  description = "鍵の仕様(RSA_2048, ECC_NIST_P256 等)"
  type        = string
  default     = "ECC_SECG_P256K1"
}

variable "deletion_window_in_days" {
  description = "キー削除時の待機期間(日数)。ポートフォリオ検証時は最短の7日推奨"
  type        = number
  default     = 7
}

variable "authorized_signer_arns" {
  description = "署名(Sign)操作を許可するIAM ARNのリスト(アプリのロール等)"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------
# KMS Asymmetric Key (Sign/Verify専用)
# -----------------------------------------------------------------
resource "aws_kms_key" "audit_signing_key" {
  description              = "tanden-trust-audit-poc: Evidence signing key (asymmetric)"
  key_usage                = "SIGN_VERIFY"
  customer_master_key_spec = var.customer_master_key_spec
  deletion_window_in_days  = var.deletion_window_in_days

  # 非対称鍵は自動ローテーション対象外(AWS側の仕様上の制約)
  # ローテーションが必要な場合は新しい鍵を作成しaliasを切り替える運用とする

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid       = "EnableRootAccountFullAccess"
          Effect    = "Allow"
          Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
          Action    = "kms:*"
          Resource  = "*"
        },
        {
          Sid       = "AllowVerifyForAnyPrincipalInAccount"
          Effect    = "Allow"
          Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
          Action    = ["kms:Verify", "kms:GetPublicKey", "kms:DescribeKey"]
          Resource  = "*"
        }
      ],
      length(var.authorized_signer_arns) > 0 ? [
        {
          Sid       = "AllowSignOnlyForAuthorizedRoles"
          Effect    = "Allow"
          Principal = { AWS = var.authorized_signer_arns }
          Action    = ["kms:Sign", "kms:DescribeKey", "kms:GetPublicKey"]
          Resource  = "*"
        }
      ] : []
    )
  })

  tags = {
    Project   = "tanden-trust-audit-poc"
    Purpose   = "evidence-signing"
    ManagedBy = "terraform"
  }
}

resource "aws_kms_alias" "audit_signing_key_alias" {
  name          = "alias/${var.key_alias_name}"
  target_key_id = aws_kms_key.audit_signing_key.key_id
}

# -----------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------
output "kms_key_id" {
  value = aws_kms_key.audit_signing_key.key_id
}

output "kms_key_arn" {
  value = aws_kms_key.audit_signing_key.arn
}

output "kms_alias_name" {
  value = aws_kms_alias.audit_signing_key_alias.name
}

output "signing_algorithm" {
  value = var.signing_algorithm
}
