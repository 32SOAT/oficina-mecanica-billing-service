import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { TransformResponseInterceptor } from '../interceptors/transform-response.interceptor';
import { getLoggerOptions } from './logger-options';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => ({ useExisting: true, pinoHttp: getLoggerOptions() }),
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
  ],
})
export class CoreModule {}
