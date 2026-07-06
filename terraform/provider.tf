# ============================================
# AWS Provider 設定
# ============================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = "ken-sso"  # SSO設定済みの正しいプロファイル
}