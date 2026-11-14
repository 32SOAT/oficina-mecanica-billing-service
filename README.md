# Billing Service

Dono do orçamento e do pagamento. Recebe o `valorTotal` já calculado pela OS e cobra a retirada no Mercado Pago, no Checkout Transparente via Orders.

A divisão dos três serviços e a razão de cada banco ficar na própria aplicação estão na ADR do OS Service: `oficina-mecanica-os-service/docs/adr/001-divisao-dos-servicos-e-banco-por-aplicacao.md`. A consulta do pagamento pendente, em vez de webhook, está em `oficina-mecanica-os-service/docs/adr/002-consulta-ativa-do-pagamento.md`.

## O que fica aqui

- Orçamento da ordem: `GERADO`, `APROVADO`, `REPROVADO`.
- Pagamento da retirada: `PENDENTE`, `APROVADO`, `RECUSADO`.
- Checkout Transparente: a página tokeniza o cartão com a Public Key e o backend cria a order com o Access Token.

## O que não fica aqui

- Preço de mão de obra, peças e status da ordem ficam na OS.
- Diagnóstico e reparo ficam na execução.

## Pagamento

O Access Token fica só no `.env` deste serviço. A Public Key vai para o navegador. Pagamento recusado deixa a ordem em `FINALIZADA` e impede `ENTREGUE`. Estorno não faz parte deste fluxo.

Um pagamento que continua `PENDENTE` é consultado de novo no Mercado Pago a cada 10 minutos (`MERCADOPAGO_POLL_INTERVAL_MS=600000`), e também quando alguém lê o pagamento. Não há webhook: o ambiente em nuvem não fica ligado o tempo todo.

## Banco

Postgres `oficina_billing` neste repositório, porta **5433**. O schema é criado na subida da aplicação. Não há conexão com o banco da OS nem com o da execução.

No Kubernetes, `kubernetes/base` cria `oficina-billing-postgres` com PVC, credenciais e política de rede próprios. O serviço usa apenas esse banco; nenhuma credencial da OS é compartilhada.

## Deploy Kubernetes independente

Os recursos AWS próprios e a ordem de configuração estão em [infra/aws/README.md](infra/aws/README.md). Cada ambiente tem state Terraform e ECR separados; execute o apply apenas após revisão da infraestrutura.

`.github/workflows/deploy.yml` valida lint/cobertura/build, publica a imagem no ECR e aplica os manifests em `homolog`/`main` quando `DEPLOY_ENABLED=true` nas variables do repositório. Configure `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER_NAME`, `DEPLOY_ROLE_ARN`, `SERVICE_ROLE_ARN`, `ECR_REPOSITORY_URL`, `SQS_COMMANDS_QUEUE_URL` e `SQS_RESULTS_QUEUE_URL` como variables. Configure `POSTGRES_USER`, `POSTGRES_PASSWORD` e `SAGA_TOKEN` como secrets; as credenciais de teste do Mercado Pago são opcionais para subir a API, mas necessárias para cobrar via checkout atual. ECR, roles OIDC, cluster, namespace e filas são pré-requisitos. A role do ServiceAccount `oficina-billing` deve ter acesso somente às filas do Billing. O Service Kubernetes é interno (`ClusterIP`); a rota pública de checkout continua pertencendo ao API Gateway.

## Mensageria da Saga

O worker SQS aceita geração/aprovação/reprovação de orçamento e abertura de pagamento pendente. `commandId`, alteração do orçamento/pagamento e resultado ficam persistidos na mesma transação Postgres. Em uma redelivery ele reutiliza o resultado gravado; só confirma a mensagem depois de publicar o resultado na fila da OS. Mensagens inválidas seguem para a DLQ pela política de redrive.

O `.env.example` inclui endpoint, região e URLs das filas FIFO. Para iniciar o worker, defina `SQS_WORKER_ENABLED=true` depois de copiar o arquivo para `.env` e confirmar que filas, DLQs e permissões já estão disponíveis. Localmente, as filas são criadas pelo Floci no compose do OS Service (`docker compose up -d db floci`, dentro de `oficina-mecanica-os-service`). Em AWS, configure as URLs de saída do Terraform, deixe `SQS_ENDPOINT_URL` vazio/ausente e use a role IAM do serviço. A OS publica comandos pela outbox SQS; a consulta síncrona do pagamento usada na entrega continua sendo HTTP. Consulte o [guia de operação da Saga](../oficina-mecanica-os-service/docs/operacao-saga-sqs.md) para a ordem de rollout, reconciliação e redrive seguro.

## Execução local

```bash
docker compose up -d
copy .env.example .env
npm install
npm run start:dev
```

- API: http://localhost:3002/api
- Health: http://localhost:3002/api/v1/health
- Checkout: `GET /api/v1/pagamentos/:osId/checkout`
- Cobrança, chamada pelo formulário: `POST /api/v1/pagamentos/:osId/cobrar`

Preencha `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_PUBLIC_KEY` no `.env` com as credenciais de teste. O Access Token de teste começa com `APP_USR`. A consulta síncrona de pagamento feita pela OS durante a entrega envia `x-saga-token: oficina-local`. Os comandos da Saga chegam pelo worker SQS; a página de pagamento não usa esse header.
