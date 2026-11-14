mock_provider "aws" {}

override_data {
  target = data.aws_caller_identity.current
  values = { account_id = "123456789012" }
}

override_resource {
  target = aws_ecr_repository.service
  override_during = plan
  values = { arn = "arn:aws:ecr:us-east-1:123456789012:repository/oficina-mecanica-billing-service-homologacao" }
}

override_data {
  target = data.aws_eks_cluster.target
  values = { arn = "arn:aws:eks:us-east-1:123456789012:cluster/oficina-mecanica-homologacao" }
}

run "service_owns_its_resources" {
  command = plan
  variables {
    aws_region               = "us-east-1"
    environment              = "homologacao"
    cluster_name             = "oficina-mecanica-homologacao"
    github_oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  }
  assert {
    condition     = aws_ecr_repository.service.name == "oficina-mecanica-billing-service-homologacao"
    error_message = "ECR repository must belong to this service"
  }
  assert {
    condition     = strcontains(aws_iam_role.deployer.assume_role_policy, "repo:32SOAT/oficina-mecanica-billing-service:environment:homologacao")
    error_message = "Only this repository and environment may assume deploy role"
  }
  assert {
    condition     = aws_eks_pod_identity_association.runtime.service_account == "oficina-billing" && strcontains(aws_iam_role.runtime.assume_role_policy, "pods.eks.amazonaws.com")
    error_message = "Runtime role must be bound to its own service account"
  }
  assert {
    condition     = strcontains(aws_iam_role_policy.deployer.policy, "parameter/oficina/homologacao/services/billing-checkout-nlb-hostname")
    error_message = "Deploy role may publish only the Billing checkout NLB contract"
  }
}
