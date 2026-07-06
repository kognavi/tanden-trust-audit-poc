# ============================================
# 予算アラート設定 - tanden-trust-audit-poc
# ============================================

variable "monthly_budget_limit" {
  description = "月次予算上限（USD）"
  type        = number
  default     = 20
}

variable "alert_email" {
  description = "アラート通知先メールアドレス（terraform.tfvars で設定してください）"
  type        = string
  sensitive   = true
  # default値なし — terraform.tfvars に実値を記述してください
  # 例: alert_email = "your-email@example.com"
}

variable "budget_name" {
  description = "予算名"
  type        = string
  default     = "tanden-trust-audit-poc-monthly"
}

resource "aws_sns_topic" "budget_alerts" {
  name = "tanden-trust-budget-alerts"

  tags = {
    Project   = "tanden-trust-audit-poc"
    ManagedBy = "terraform"
    Purpose   = "cost-guardrail"
  }
}

resource "aws_sns_topic_subscription" "budget_email" {
  topic_arn = aws_sns_topic.budget_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_policy" "budget_alerts_policy" {
  arn = aws_sns_topic.budget_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBudgetsPublish"
        Effect = "Allow"
        Principal = {
          Service = "budgets.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.budget_alerts.arn
      }
    ]
  })
}

resource "aws_budgets_budget" "monthly_cost" {
  name         = var.budget_name
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 50
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alerts.arn]
  }
}

output "sns_topic_arn" {
  value = aws_sns_topic.budget_alerts.arn
}

output "budget_name" {
  value = aws_budgets_budget.monthly_cost.name
}