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

`.github/workflows/deploy.yml` valida lint/cobertura/build, publica a imagem no ECR e aplica os manifests em `homolog`/`main` quando `DEPLOY_ENABLED=true` nas variables do repositório. Configure `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER_NAME`, `DEPLOY_ROLE_ARN`, `ECR_REPOSITORY_URL`, `SQS_COMMANDS_QUEUE_URL` e `SQS_RESULTS_QUEUE_URL` como variables. Configure `POSTGRES_USER`, `POSTGRES_PASSWORD` e `SAGA_TOKEN` como secrets; as credenciais de teste do Mercado Pago são opcionais para subir a API, mas necessárias para cobrar via checkout atual. ECR, roles de deploy e Pod Identity, cluster, namespace e filas são pré-requisitos. A role Pod Identity vinculada ao ServiceAccount `oficina-billing` deve ter acesso somente às filas do Billing. O Service interno continua `ClusterIP`; o deploy também cria `oficina-billing-checkout` com NLB e publica `/oficina/<ambiente>/services/billing-checkout-nlb-hostname` no SSM após verificar o health externo. O API Gateway da plataforma encaminha somente checkout e cobrança a esse NLB.

### Deploy automatizado em cluster temporário

[![Deploy Kubernetes (kind)](https://github.com/32SOAT/oficina-mecanica-billing-service/actions/workflows/deploy-kind.yml/badge.svg)](https://github.com/32SOAT/oficina-mecanica-billing-service/actions/workflows/deploy-kind.yml)

`.github/workflows/deploy-kind.yml` roda em todo PR e em `homolog`/`main`, sem depender da AWS. Ele executa o lint e os testes com cobertura, constrói a imagem, cria um cluster Kubernetes com `kind`, aplica `kubernetes/overlays/minikube`, espera o rollout e confere o health de dentro do cluster. O consumidor SQS fica desligado nesse job, porque as filas ficam no overlay do OS Service. Exemplo: [execução de 17/11/2026](https://github.com/32SOAT/oficina-mecanica-billing-service/actions/runs/44022564333).

## Mensageria da Saga

A Saga é orquestrada pelo OS Service, e este serviço é um participante: recebe comandos pela fila, aplica e devolve o resultado. A justificativa da escolha está no [README do OS Service](https://github.com/32SOAT/oficina-mecanica-os-service#por-que-saga-orquestrada) e na ADR 001 daquele repositório.

O worker SQS aceita geração/aprovação/reprovação de orçamento e abertura de pagamento pendente. `commandId`, alteração do orçamento/pagamento e resultado ficam persistidos na mesma transação Postgres. Em uma redelivery ele reutiliza o resultado gravado; só confirma a mensagem depois de publicar o resultado na fila da OS. Mensagens inválidas seguem para a DLQ pela política de redrive.

O `.env.example` inclui endpoint, região e URLs das filas FIFO. Para iniciar o worker, defina `SQS_WORKER_ENABLED=true` depois de copiar o arquivo para `.env` e confirmar que filas, DLQs e permissões já estão disponíveis. Localmente, as filas são criadas pelo Floci no compose do OS Service (`docker compose up -d db floci`, dentro de `oficina-mecanica-os-service`). Em AWS, configure as URLs de saída do Terraform, deixe `SQS_ENDPOINT_URL` vazio/ausente e use a role IAM do serviço. A OS publica comandos pela outbox SQS; a consulta síncrona do pagamento usada na entrega continua sendo HTTP. Consulte o [guia de operação da Saga](../oficina-mecanica-os-service/docs/operacao-saga-sqs.md) para a ordem de rollout, reconciliação e redrive seguro.

## Testes e cobertura

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=32SOAT_oficina-mecanica-billing-service&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=32SOAT_oficina-mecanica-billing-service)
[![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=32SOAT_oficina-mecanica-billing-service&metric=coverage)](https://sonarcloud.io/component_measures?id=32SOAT_oficina-mecanica-billing-service&metric=coverage)

O CI (`.github/workflows/ci.yml`) roda os testes com cobertura e o SonarCloud em todo PR. O Jest falha abaixo de 80% (`coverageThreshold` no `package.json`) e o pipeline espera o quality gate do SonarCloud.

Cobertura do Jest na [execução do CI de 17/11/2026](https://github.com/32SOAT/oficina-mecanica-billing-service/actions/runs/44019077036), com 65 testes:

| Instruções | Ramos | Funções | Linhas |
| --- | --- | --- | --- |
| 93,76% | 82,55% | 95,77% | 94,70% |

Para conferir localmente: `npm run test:cov`.

## Observabilidade

O serviço envia traces e logs para o Datadog, a mesma ferramenta da Fase 3.

- **Traces:** o `dd-trace` é carregado na inicialização (`--require dd-trace/init`). Cada comando da Saga roda no span `saga.command`, que continua o trace iniciado na OS (`src/saga/sqs/saga-trace.ts`). A etapa aparece num trace só: OS, fila, Billing, fila e OS.
- **Logs:** saem em JSON com o identificador do trace (`dd.trace_id`), então cada log leva ao seu trace. O nível sai como texto (`error`, `warn`), que é como o Datadog reconhece o status.

No Kubernetes, `kubernetes/base/deployment.yaml` aponta o tracer para o Agent do nó (`DD_AGENT_HOST`) e define `DD_SERVICE=oficina-billing`; `DD_ENV` e `DD_VERSION` vêm do `scripts/deploy-kubernetes.sh`. Sem Agent, o serviço roda igual e não envia nada.

Os valores do Agent, o dashboard e os monitores ficam em `kubernetes/datadog` no repositório [oficina-mecanica-infra-k8s](https://github.com/32SOAT/oficina-mecanica-infra-k8s). Os prints do dashboard e de um trace da Saga estão no [README do OS Service](https://github.com/32SOAT/oficina-mecanica-os-service#observabilidade).

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

Para o BDD distribuído, `MERCADOPAGO_API_BASE_URL` permite apontar o cliente HTTP para um mock local do provedor; o padrão continua `https://api.mercadopago.com`. A variável não é configurada pelo deploy de produção. A suíte completa e o CI estão descritos no README da OS.

## Cluster local (minikube)

O overlay `kubernetes/overlays/minikube` reaproveita o `kubernetes/base` e acrescenta só o que é local: imagem, variáveis e a porta 30082 no Service do checkout. Aplique antes o overlay do OS Service, que traz o SQS local (Floci).

```bash
minikube image build -t oficina-mecanica-billing-service:local .
kubectl apply -k kubernetes/overlays/minikube
```

O overlay não define credenciais do Mercado Pago. Para cobrar pelo checkout, informe as de teste: `kubectl -n oficina-mecanica set env deploy/oficina-billing MERCADOPAGO_ACCESS_TOKEN=<token> MERCADOPAGO_PUBLIC_KEY=<chave>`.
