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
});
