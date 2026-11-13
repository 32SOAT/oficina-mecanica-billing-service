import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsConfig } from './sqs.config';

export const SQS_CLIENT = 'SQS_CLIENT';

@Module({
  providers: [
    {
      provide: SQS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<{ sqs: SqsConfig }>) => {
        const sqs = config.getOrThrow('sqs', { infer: true });
        return new SQSClient({
          region: sqs.region,
          ...(sqs.endpoint ? { endpoint: sqs.endpoint } : {}),
        });
      },
    },
  ],
  exports: [SQS_CLIENT],
})
export class SqsClientModule {}
