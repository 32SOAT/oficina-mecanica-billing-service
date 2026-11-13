import { sqsConfig } from './sqs.config';

describe('Billing SQS worker configuration', () => {
  const names = [
    'SQS_WORKER_ENABLED',
    'SQS_ENDPOINT_URL',
    'SQS_REGION',
    'SQS_COMMANDS_QUEUE_URL',
    'SQS_RESULTS_QUEUE_URL',
  ] as const;
  const original = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );

  afterEach(() => {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('keeps the worker disabled with no queue URLs by default', () => {
    for (const name of names) delete process.env[name];

    expect(sqsConfig()).toEqual({
      enabled: false,
      endpoint: undefined,
      region: 'us-east-1',
      commandQueueUrl: undefined,
      resultsQueueUrl: undefined,
    });
  });

  it('uses the configured queues, region and endpoint when enabled', () => {
    process.env.SQS_WORKER_ENABLED = 'true';
    process.env.SQS_ENDPOINT_URL = 'http://localhost:4566';
    process.env.SQS_REGION = 'sa-east-1';
    process.env.SQS_COMMANDS_QUEUE_URL = 'commands.fifo';
    process.env.SQS_RESULTS_QUEUE_URL = 'results.fifo';

    expect(sqsConfig()).toEqual({
      enabled: true,
      endpoint: 'http://localhost:4566',
      region: 'sa-east-1',
      commandQueueUrl: 'commands.fifo',
      resultsQueueUrl: 'results.fifo',
    });
  });
});
