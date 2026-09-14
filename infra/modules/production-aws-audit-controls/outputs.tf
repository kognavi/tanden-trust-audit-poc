output "trail_name" {
  description = "Name of the multi-Region audit trail."
  value       = aws_cloudtrail.audit.name
}

output "trail_arn" {
  description = "ARN of the multi-Region audit trail."
  value       = aws_cloudtrail.audit.arn
}

output "log_bucket_name" {
  description = "Name of the dedicated CloudTrail log bucket."
  value       = aws_s3_bucket.audit_logs.id
}

output "log_bucket_arn" {
  description = "ARN of the dedicated CloudTrail log bucket."
  value       = aws_s3_bucket.audit_logs.arn
}

output "notification_topic_arn" {
  description = "SNS topic ARN to which an approved subscription can later be attached."
  value       = aws_sns_topic.security_notifications.arn
}

output "event_rule_arns" {
  description = "ARNs of the security-sensitive API detection rules."
  value       = { for name, rule in aws_cloudwatch_event_rule.security_controls : name => rule.arn }
}
