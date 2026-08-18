terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = "ken-sso"
}

module "kms_signing" {
  source = "../../modules/kms-signing"

  project_name             = "tanden-trust-audit-poc"
  deletion_window_in_days  = 7
  create_iam_policies      = true

  signer_principal_arns    = []
  verifier_principal_arns  = []
  key_admin_principal_arns = []
}

output "kms_key_id_for_env" {
  value = module.kms_signing.key_arn
}
