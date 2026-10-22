# Billing Service

Dono do orçamento e do pagamento local. Recebe o `valorTotal` já calculado pela OS e não consulta catálogo, estoque nem cliente.

A divisão dos três serviços e a razão de cada banco ficar na própria aplicação estão na ADR do OS Service: `oficina-mecanica-os-service/docs/adr/001-divisao-dos-servicos-e-banco-por-aplicacao.md`.

## O que fica aqui

- Orçamento da ordem: `GERADO`, `APROVADO`, `REPROVADO`.
- Pagamento da retirada: `PENDENTE`, `APROVADO`, `RECUSADO`.
- Confirmação e recusa do pagamento, chamadas pela operação com o header `x-saga-token`.

## O que não fica aqui

- Preço de mão de obra, peças e status da ordem ficam na OS.
- Diagnóstico e reparo ficam na execução.
- Mercado Pago fica para a próxima etapa. Recusar o pagamento mantém a ordem em `FINALIZADA` e impede `ENTREGUE`.

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
- Confirmar pagamento: `POST /api/v1/pagamentos/:osId/confirmar`
- Recusar pagamento: `POST /api/v1/pagamentos/:osId/recusar`

As chamadas feitas pela OS enviam o header `x-saga-token: oficina-local`. Use o mesmo header para confirmar o pagamento.
