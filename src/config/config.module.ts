import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig, envValidationSchema, AppConfig } from './env/app.config';
import { SqsConfig, sqsConfig } from '../saga/sqs/sqs.config';

export interface ConfigType {
  app: AppConfig;
  sqs: SqsConfig;
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [appConfig, sqsConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
      isGlobal: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
