variable "project_name" {
  description = "プロジェクト識別子(命名・タグ付けに使用)"
  type        = string
  default     = "tanden-trust-audit-poc"
}

variable "description" {
  description = "KMSキーの説明文"
  type        = string
  default     = "tanden-trust-audit-poc: Evidence signing key (asymmetric)"
}

variable "alias_name" {
  description = "KMSキーのエイリアス名('alias/'プレフィックスなし)"
  type        = string
  default     = "tanden-trust-audit-signing"
}

variable "key_spec" {
  description = "KMS非対称鍵のKeySpec。lib/aws-kms-provider.jsのEXPECTED_KEY_SPECと必ず一致させること。"
  type    = string
  default = "ECC_SECG_P256K1"
}

variable "key_usage" {
  description = "KMSキーの用途"
  type        = string
  default     = "SIGN_VERIFY"
}

variable "deletion_window_in_days" {
  description = "ScheduleKeyDeletion後、完全削除までの待機期間(7〜30日)"
  type        = number
  default     = 7

  validation {
    condition     = var.deletion_window_in_days >= 7 && var.deletion_window_in_days <= 30
    error_message = "deletion_window_in_days must be between 7 and 30."
  }
}

variable "signer_principal_arns" {
  description = "kms:Sign + kms:GetPublicKeyのみ許可するIAM ARNリスト"
  type        = list(string)
  default     = []
}

variable "verifier_principal_arns" {
  description = "kms:Verify + kms:GetPublicKeyのみ許可するIAM ARNリスト"
  type        = list(string)
  default     = []
}

variable "key_admin_principal_arns" {
  description = "鍵管理(ライフサイクル)権限を持つが署名/検証は行わないIAM ARNリスト"
  type        = list(string)
  default     = []
}

variable "create_iam_policies" {
  description = "sign-only/verify-only IAMポリシーを作成するか"
  type        = bool
  default     = true
}

variable "tags" {
  description = "モジュール管理タグに追加でマージするタグ"
  type        = map(string)
  default     = {}
}
