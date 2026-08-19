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
