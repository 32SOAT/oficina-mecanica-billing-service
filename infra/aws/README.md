# AWS resources owned by oficina-mecanica-billing-service

This Terraform root owns one ECR repository per environment, one GitHub OIDC deploy role and one EKS runtime role per environment. It does not own the shared EKS cluster, GitHub OIDC provider, EKS OIDC provider, SQS queues, or any other service database. The OS Saga SQS Terraform root attaches queue policies to the runtime role names output here.

Use a **different S3 backend key** for `homologacao` and `producao`. The platform team provides the shared cluster name, the existing GitHub and EKS OIDC provider ARNs, and the EKS issuer URL. Never store credentials in tfvars or the backend configuration file.

```sh
terraform init -backend-config=bucket=<state-bucket> -backend-config=key=services/billing/<environment>.tfstate -backend-config=region=<region>
terraform plan -var='aws_region=<region>' -var='environment=<homologacao-or-producao>' -var='cluster_name=<cluster>' -var='github_oidc_provider_arn=<arn>' -var='eks_oidc_provider_arn=<arn>' -var='eks_oidc_issuer_url=<url>'
```

After review and an authorized apply, copy only `ecr_repository_url`, `deployer_role_arn` and `runtime_role_arn` to the corresponding GitHub Environment variables `ECR_REPOSITORY_URL`, `DEPLOY_ROLE_ARN` and `SERVICE_ROLE_ARN`. Set `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER_NAME` and queue URLs there too. The namespace `oficina-mecanica` must exist. Enable repository variable `DEPLOY_ENABLED=true` only after the environment is configured. Do not run this root from the app deployment workflow; it has a separate state and approval lifecycle.
