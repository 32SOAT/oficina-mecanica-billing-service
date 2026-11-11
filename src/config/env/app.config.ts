import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface AppConfig {
  environment: string;
  port: number;
  serviceName: string;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.APP_PORT ?? '3002', 10),
  serviceName: process.env.SERVICE_NAME ?? 'billing-service',
}));

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_PORT: Joi.number().default(3002),
  SERVICE_NAME: Joi.string().default('billing-service'),
  POSTGRES_HOST: Joi.string().default('localhost'),
  POSTGRES_PORT: Joi.number().default(5433),
  POSTGRES_USER: Joi.string().default('oficina'),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().default('oficina_billing'),
  SAGA_TOKEN: Joi.string().default('oficina-local'),
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().allow('').optional(),
  MERCADOPAGO_PUBLIC_KEY: Joi.string().allow('').optional(),
  MERCADOPAGO_POLL_INTERVAL_MS: Joi.number().min(5000).default(600000),
  SQS_WORKER_ENABLED: Joi.boolean().default(false),
  SQS_ENDPOINT_URL: Joi.string().uri().allow('').optional(),
  SQS_REGION: Joi.string().default('us-east-1'),
  SQS_COMMANDS_QUEUE_URL: Joi.when('SQS_WORKER_ENABLED', {
    is: true,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional(),
  }),
  SQS_RESULTS_QUEUE_URL: Joi.when('SQS_WORKER_ENABLED', {
    is: true,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional(),
  }),
});
