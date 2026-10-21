# Billing Service

Esqueleto NestJS do microsserviço `billing-service` da oficina mecânica.

Dono de orçamento, aprovação e pagamento. A cobrança será integrada ao Mercado Pago.

PostgreSQL próprio, ainda não ligado. O banco entra neste repositório quando as responsabilidades saírem do monólito.

A regra de negócio ainda está no monólito `oficina-mecanica-api` e será transferida para cá.

## Stack

NestJS 11 · TypeScript · Pino · Swagger · Jest · ESLint · Docker

## Execução local

```bash
npm install
copy .env.example .env
npm run start:dev
```

- Health: http://localhost:3002/api/v1/health
- Swagger: http://localhost:3002/api

## Testes

```bash
npm test
npm run test:cov
npm run test:e2e
npm run lint:check
```
