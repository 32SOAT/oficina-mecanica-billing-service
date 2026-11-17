output "ecr_repository_url" { value = aws_ecr_repository.service.repository_url }
output "deployer_role_arn" { value = aws_iam_role.deployer.arn }
output "runtime_role_arn" { value = aws_iam_role.runtime.arn }
output "runtime_role_name" { value = aws_iam_role.runtime.name }
