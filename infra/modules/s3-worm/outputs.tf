output "bucket_name" {
  description = "作成されたS3バケット名"
  value       = aws_s3_bucket.audit_trail.id
}

output "bucket_arn" {
  description = "作成されたS3バケットARN"
  value       = aws_s3_bucket.audit_trail.arn
}

output "retention_mode" {
  description = "設定されたObject Lock保持モード(COMPLIANCE/GOVERNANCE)"
  value       = var.retention_mode
}

output "retention_days" {
  description = "設定されたObject Lock保持日数"
  value       = var.retention_days
}

output "versioning_status" {
  description = "バケットのバージョニング状態(Object Lockの前提条件)"
  value       = aws_s3_bucket_versioning.audit_trail.versioning_configuration[0].status
}

output "sse_algorithm" {
  description = "デフォルト暗号化アルゴリズム(SSE-S3: AES256)"
  value = one([
    for r in aws_s3_bucket_server_side_encryption_configuration.audit_trail.rule : one([
      for d in r.apply_server_side_encryption_by_default : d.sse_algorithm
    ])
  ])
}


output "deny_delete_policy_id" {
  description = "削除操作を拒否するバケットポリシーのID(適用確認用)"
  value       = aws_s3_bucket_policy.deny_delete.id
}

output "break_glass_role_arn" {
  description = "設定されているbreak-glassロールARN(未設定時は空文字)"
  value       = var.break_glass_role_arn
}
