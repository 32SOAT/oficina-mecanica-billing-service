data "aws_caller_identity" "current" {}
data "aws_eks_cluster" "target" { name = var.cluster_name }

locals {
  repository_name = "oficina-mecanica-billing-service-${var.environment}"
  service_account = "oficina-billing"
  github_subject  = "repo:32SOAT/oficina-mecanica-billing-service:environment:${var.environment}"
}

resource "aws_ecr_repository" "service" {
  name                 = local.repository_name
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_iam_role" "deployer" {
  name                 = "oficina-${var.environment}-billing-deployer"
  permissions_boundary = var.permissions_boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = var.github_oidc_provider_arn }
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = local.github_subject
      } }
    }]
  })
}

resource "aws_iam_role_policy" "deployer" {
  name = "deploy-own-service"
  role = aws_iam_role.deployer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["eks:DescribeCluster"], Resource = [data.aws_eks_cluster.target.arn] },
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = ["*"] },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:DescribeImages", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"], Resource = [aws_ecr_repository.service.arn] }
    ]
  })
}

resource "aws_eks_access_entry" "deployer" {
  cluster_name  = var.cluster_name
  principal_arn = aws_iam_role.deployer.arn
  type          = "STANDARD"
}
resource "aws_eks_access_policy_association" "deployer" {
  cluster_name  = var.cluster_name
  principal_arn = aws_iam_role.deployer.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"
  access_scope {
    type       = "namespace"
    namespaces = ["oficina-mecanica"]
  }
  depends_on = [aws_eks_access_entry.deployer]
}

resource "aws_iam_role" "runtime" {
  name                 = "oficina-${var.environment}-billing-runtime"
  permissions_boundary = var.permissions_boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = ["sts:AssumeRole", "sts:TagSession"]
      Principal = { Service = "pods.eks.amazonaws.com" }
    }]
  })
}

resource "aws_eks_pod_identity_association" "runtime" {
  cluster_name    = var.cluster_name
  namespace       = "oficina-mecanica"
  service_account = local.service_account
  role_arn        = aws_iam_role.runtime.arn
}
