import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig, envValidationSchema, AppConfig } from './env/app.config';

export interface ConfigType {
  app: AppConfig;
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [appConfig],
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
