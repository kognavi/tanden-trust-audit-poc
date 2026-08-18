output "key_id" {
  description = "KMSキーID"
  value       = aws_kms_key.signing_key.key_id
}

output "key_arn" {
  description = "KMSキーARN。AwsKmsProviderのKMS_KEY_ID環境変数にこれを設定する"
  value       = aws_kms_key.signing_key.arn
}

output "alias_name" {
  description = "KMSキーのエイリアス名"
  value       = aws_kms_alias.signing_key_alias.name
}

output "alias_arn" {
  description = "KMSキーエイリアスのARN"
  value       = aws_kms_alias.signing_key_alias.arn
}

output "key_spec" {
  description = "設定されたKeySpec(ECC_SECG_P256K1であるべき)"
  value       = aws_kms_key.signing_key.customer_master_key_spec
}

output "sign_only_policy_arn" {
  description = "sign-only IAMポリシーARN"
  value       = var.create_iam_policies ? aws_iam_policy.sign_only[0].arn : null
}

output "verify_only_policy_arn" {
  description = "verify-only IAMポリシーARN"
  value       = var.create_iam_policies ? aws_iam_policy.verify_only[0].arn : null
}
