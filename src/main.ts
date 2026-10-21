import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap/configure-app';
import { configureSwagger } from './common/bootstrap/configure-swagger';
import { getLoggerOptions } from './common/core/logger-options';
import { ConfigType } from './config/config.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  configureApp(app);

  const configService = app.get<ConfigService<ConfigType, true>>(ConfigService);
  const port = configService.get('app.port', { infer: true });

  configureSwagger(app);
  await app.listen(port);
}

bootstrap().catch((err) => {
  pino(getLoggerOptions()).fatal({ err }, 'Application bootstrap failed');
  process.exit(1);
});
