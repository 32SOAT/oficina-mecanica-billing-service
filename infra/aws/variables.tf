variable "aws_region" { type = string }
variable "environment" {
  type = string
  validation {
    condition     = contains(["homologacao", "producao"], var.environment)
    error_message = "environment must be homologacao or producao"
  }
}
variable "cluster_name" { type = string }
variable "github_oidc_provider_arn" { type = string }
variable "eks_oidc_provider_arn" { type = string }
variable "eks_oidc_issuer_url" { type = string }
variable "permissions_boundary_arn" {
  type    = string
  default = null
}
