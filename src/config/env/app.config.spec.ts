import { envValidationSchema } from './app.config';

describe('Billing SQS environment', () => {
  const base = { POSTGRES_PASSWORD: 'local-test' };

  it('keeps SQS worker disabled when queue configuration is absent', () => {
    const { error, value } = envValidationSchema.validate(base);

    expect(error).toBeUndefined();
    expect(value.SQS_WORKER_ENABLED).toBe(false);
  });

  it('requires both queue URLs when the worker is enabled', () => {
    for (const missing of ['SQS_COMMANDS_QUEUE_URL', 'SQS_RESULTS_QUEUE_URL']) {
      const { error } = envValidationSchema.validate({
        ...base,
        SQS_WORKER_ENABLED: 'true',
        SQS_COMMANDS_QUEUE_URL:
          missing === 'SQS_COMMANDS_QUEUE_URL' ? undefined : 'http://commands',
        SQS_RESULTS_QUEUE_URL:
          missing === 'SQS_RESULTS_QUEUE_URL' ? undefined : 'http://results',
      });

      expect(error?.details[0].path[0]).toBe(missing);
    }
  });

  it('accepts local queue URLs when the worker is enabled', () => {
    const { error } = envValidationSchema.validate({
      ...base,
      SQS_WORKER_ENABLED: 'true',
      SQS_COMMANDS_QUEUE_URL:
        'http://localhost:4566/000000000000/oficina-billing-commands.fifo',
      SQS_RESULTS_QUEUE_URL:
        'http://localhost:4566/000000000000/oficina-os-results.fifo',
    });

    expect(error).toBeUndefined();
  });
});
