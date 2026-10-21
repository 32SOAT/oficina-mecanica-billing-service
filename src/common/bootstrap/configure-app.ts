import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { getLoggerOptions } from '../core/logger-options';
import { ApplicationExceptionFilter } from '../presentation/filters/application-exception.filter';

export function configureApp(app: INestApplication): void {
  app.use(
    pinoHttp({
      ...getLoggerOptions(),
      genReqId: (req, res) => {
        const header = req.headers['x-correlation-id'];
        const correlationId =
          (Array.isArray(header) ? header[0] : header) || randomUUID();
        res.setHeader('x-correlation-id', correlationId);
        return correlationId;
      },
      customProps: (req) => ({ correlationId: req.id }),
    }),
  );
  const httpApp = app.getHttpAdapter().getInstance() as {
    disable: (name: string) => void;
  };
  httpApp.disable('x-powered-by');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new ApplicationExceptionFilter());
}
