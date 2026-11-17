# AWS resources owned by oficina-mecanica-billing-service

This Terraform root owns one ECR repository per environment, one GitHub OIDC deploy role and one EKS Pod Identity runtime role and association per environment. It does not own the shared EKS cluster, GitHub OIDC provider, SQS queues, or any other service database. Apply this root first; then the OS Saga SQS Terraform root attaches queue policies to the runtime role names output here. Deploy the applications after those policies and the queues exist.

Use a **different S3 backend key** for `homologacao` and `producao`. The platform team provides the shared cluster name, the existing GitHub OIDC provider ARN and the EKS Pod Identity agent. Never store credentials in tfvars or the backend configuration file.

```sh
terraform init -backend-config=bucket=<state-bucket> -backend-config=key=services/billing/<environment>.tfstate -backend-config=region=<region>
terraform plan -var='aws_region=<region>' -var='environment=<homologacao-or-producao>' -var='cluster_name=<cluster>' -var='github_oidc_provider_arn=<arn>'
```

After review and an authorized apply, copy only `ecr_repository_url`, `deployer_role_arn` to the corresponding GitHub Environment variables `ECR_REPOSITORY_URL`, `DEPLOY_ROLE_ARN`. Set `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER_NAME` and queue URLs there too. The namespace `oficina-mecanica` must exist. Enable repository variable `DEPLOY_ENABLED=true` only after the environment is configured. Do not run this root from the app deployment workflow; it has a separate state and approval lifecycle.

The deploy role can publish only `/oficina/<environment>/services/billing-checkout-nlb-hostname` in SSM. The deployment creates a separate public NLB for checkout, checks its health, and publishes the hostname. The platform Terraform root reads it for the two public payment routes; it does not create or own the parameter.
