import { registerAs } from '@nestjs/config';

export interface SqsConfig {
  enabled: boolean;
  endpoint?: string;
  region: string;
  commandQueueUrl?: string;
  resultsQueueUrl?: string;
}

export const sqsConfig = registerAs('sqs', (): SqsConfig => ({
  enabled: process.env.SQS_WORKER_ENABLED === 'true',
  endpoint: process.env.SQS_ENDPOINT_URL || undefined,
  region: process.env.SQS_REGION ?? 'us-east-1',
  commandQueueUrl: process.env.SQS_COMMANDS_QUEUE_URL || undefined,
  resultsQueueUrl: process.env.SQS_RESULTS_QUEUE_URL || undefined,
}));
