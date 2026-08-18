terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "signing_key" {

  # nosemgrep: terraform.aws.security.aws-kms-no-rotation.aws-kms-no-rotation
  # 根拠: このキーは非対称鍵(ECC_SECG_P256K1 / SIGN_VERIFY)であり、
  # AWS KMSの自動ローテーション機能は非対称鍵をサポートしていない。
  # (enable_key_rotation=true を設定すると terraform apply が
  #  AWS API の ValidationException で失敗する)
  # 参考: https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
  description              = var.description
  customer_master_key_spec = var.key_spec
  key_usage                = var.key_usage
  deletion_window_in_days  = var.deletion_window_in_days
  is_enabled               = true

  policy = data.aws_iam_policy_document.key_policy.json

  tags = merge(
    var.tags,
    {
      Project   = var.project_name
      Purpose   = "evidence-signing"
      Curve     = "secp256k1-blockchain-compatible"
      ManagedBy = "terraform"
    }
  )
}

resource "aws_kms_alias" "signing_key_alias" {
  name          = "alias/${var.alias_name}"
  target_key_id = aws_kms_key.signing_key.key_id
}

data "aws_iam_policy_document" "key_policy" {
  statement {
    sid    = "EnableRootAccountFullAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = length(var.signer_principal_arns) > 0 ? [1] : []
    content {
      sid    = "AllowSigningOnly"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = var.signer_principal_arns
      }
      actions   = ["kms:Sign", "kms:GetPublicKey"]
      resources = ["*"]
    }
  }

  dynamic "statement" {
    for_each = length(var.verifier_principal_arns) > 0 ? [1] : []
    content {
      sid    = "AllowVerificationOnly"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = var.verifier_principal_arns
      }
      actions   = ["kms:Verify", "kms:GetPublicKey"]
      resources = ["*"]
    }
  }

  dynamic "statement" {
    for_each = length(var.key_admin_principal_arns) > 0 ? [1] : []
    content {
      sid    = "AllowKeyAdministration"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = var.key_admin_principal_arns
      }
      actions = [
        "kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*",
        "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*",
        "kms:Get*", "kms:Delete*", "kms:TagResource", "kms:UntagResource",
        "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion",
      ]
      resources = ["*"]
    }
  }
}

resource "aws_iam_policy" "sign_only" {
  count       = var.create_iam_policies ? 1 : 0
  name        = "${var.project_name}-kms-sign-only"
  description = "最小権限: 署名のみ許可(検証・管理は不可)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Sign", "kms:GetPublicKey"]
      Resource = aws_kms_key.signing_key.arn
    }]
  })
}

resource "aws_iam_policy" "verify_only" {
  count       = var.create_iam_policies ? 1 : 0
  name        = "${var.project_name}-kms-verify-only"
  description = "最小権限: 検証のみ許可(署名・管理は不可)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Verify", "kms:GetPublicKey"]
      Resource = aws_kms_key.signing_key.arn
    }]
  })
}
