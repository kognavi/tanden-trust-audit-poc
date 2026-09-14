variable "project_name" {
  description = "Resource name and tag prefix."
  type        = string
  default     = "tanden-trust-audit"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{2,31}$", var.project_name))
    error_message = "project_name must be 3-32 lowercase alphanumeric or hyphen characters."
  }
}

variable "source_account_id" {
  description = "Twelve-digit AWS account ID that owns the trail and receives the logs."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.source_account_id))
    error_message = "source_account_id must be a 12-digit AWS account ID."
  }
}

variable "home_region" {
  description = "AWS Region in which the trail, EventBridge rules, and SNS topic are managed."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2}(-gov)?-[a-z]+-[0-9]$", var.home_region))
    error_message = "home_region must be a valid AWS Region identifier."
  }
}

variable "aws_partition" {
  description = "AWS ARN partition."
  type        = string
  default     = "aws"

  validation {
    condition     = contains(["aws", "aws-us-gov", "aws-cn"], var.aws_partition)
    error_message = "aws_partition must be aws, aws-us-gov, or aws-cn."
  }
}

variable "evidence_bucket_arn" {
  description = "ARN of the existing Evidence bucket whose object-level data events are recorded."
  type        = string

  validation {
    condition     = can(regex("^arn:(aws|aws-us-gov|aws-cn):s3:::[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.evidence_bucket_arn))
    error_message = "evidence_bucket_arn must be a bucket ARN without an object suffix."
  }
}

variable "log_bucket_name" {
  description = "Globally unique name for the dedicated CloudTrail log bucket."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.log_bucket_name)) && !can(regex("\\.\\.", var.log_bucket_name))
    error_message = "log_bucket_name must satisfy the general-purpose S3 bucket naming rules."
  }
}

variable "log_retention_days" {
  description = "Days to retain current and noncurrent CloudTrail log object versions."
  type        = number
  default     = 365

  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 3653 && floor(var.log_retention_days) == var.log_retention_days
    error_message = "log_retention_days must be an integer from 30 through 3653."
  }
}

variable "tags" {
  description = "Additional tags merged into module-managed resources."
  type        = map(string)
  default     = {}
}
