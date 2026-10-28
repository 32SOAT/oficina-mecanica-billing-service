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

Preencha `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_PUBLIC_KEY` no `.env` com as credenciais de teste. O Access Token de teste começa com `APP_USR`. As chamadas feitas pela OS continuam enviando o header `x-saga-token: oficina-local`. A página de pagamento não usa esse header.
