import {
  DeleteMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { SagaCommandConsumer } from './saga-command-consumer';
import { SagaCommandMessage } from '../saga-message';

const command: SagaCommandMessage = {
  messageId: '00000000-0000-4000-8000-000000000001',
  commandId: '00000000-0000-4000-8000-000000000002',
  sagaId: '00000000-0000-4000-8000-000000000003',
  osId: '00000000-0000-4000-8000-000000000004',
  occurredAt: '2026-11-08T10:00:00.000Z',
  correlationId: '00000000-0000-4000-8000-000000000003',
  causationId: null,
  schemaVersion: 1,
  type: 'BILLING_QUOTE_GENERATE',
  payload: { valorTotal: 123.45 },
};

describe('SagaCommandConsumer', () => {
  it('does not start polling when the worker is disabled', () => {
    const client = { send: jest.fn(), destroy: jest.fn() };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      { processSagaCommand: jest.fn() } as never,
      new ConfigService({ sqs: { enabled: false } }),
    );

    consumer.onModuleInit();
    consumer.onModuleDestroy();

    expect(client.send).not.toHaveBeenCalled();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { commandQueueUrl: undefined, resultsQueueUrl: 'results' },
    { commandQueueUrl: 'commands', resultsQueueUrl: undefined },
  ])('rejects enabled workers without both queue URLs', (urls) => {
    const client = { send: jest.fn() };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      { processSagaCommand: jest.fn() } as never,
      new ConfigService({ sqs: { enabled: true, ...urls } }),
    );

    expect(() => consumer.onModuleInit()).toThrow(/URLs SQS/);
    expect(client.send).not.toHaveBeenCalled();
  });

  it.each([
    { Body: undefined, ReceiptHandle: 'receipt' },
    { Body: JSON.stringify(command), ReceiptHandle: undefined },
  ])('does not process a message without body and receipt', async (message) => {
    const client = { send: jest.fn() };
    const handler = { processSagaCommand: jest.fn() };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({ sqs: { enabled: true } }),
    );

    await consumer.processMessage(message);

    expect(handler.processSagaCommand).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });

  it('leaves malformed JSON on the queue for redrive', async () => {
    const client = { send: jest.fn() };
    const handler = { processSagaCommand: jest.fn() };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({ sqs: { enabled: true } }),
    );

    await consumer.processMessage({ Body: '{', ReceiptHandle: 'receipt' });

    expect(handler.processSagaCommand).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });

  it('retains the command if the participant cannot persist its result', async () => {
    const client = { send: jest.fn() };
    const handler = {
      processSagaCommand: jest
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
    };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({ sqs: { enabled: true } }),
    );

    await expect(
      consumer.processMessage({
        Body: JSON.stringify(command),
        ReceiptHandle: 'receipt',
      }),
    ).rejects.toThrow('database unavailable');
    expect(client.send).not.toHaveBeenCalled();
  });
  it('publishes the result before deleting the command', async () => {
    const calls: string[] = [];
    const client = {
      send: jest.fn((input: unknown) => {
        if (input instanceof SendMessageCommand) calls.push('publish');
        if (input instanceof DeleteMessageCommand) calls.push('delete');
        return Promise.resolve({});
      }),
    };
    const handler = {
      processSagaCommand: jest.fn().mockResolvedValue({
        ...command,
        messageId: '00000000-0000-4000-8000-000000000006',
        type: 'SAGA_STEP_RESULT',
        causationId: command.messageId,
        outcome: 'CONCLUIDA',
        payload: {},
      }),
    };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({
        sqs: {
          enabled: true,
          region: 'us-east-1',
          endpoint: 'http://localhost:4566',
          commandQueueUrl: 'http://localhost:4566/commands.fifo',
          resultsQueueUrl: 'http://localhost:4566/results.fifo',
          pollIntervalMs: 1000,
        },
      }),
    );

    await consumer.processMessage({
      Body: JSON.stringify(command),
      MessageId: 'sqs-message-id',
      ReceiptHandle: 'receipt',
    });

    expect(calls).toEqual(['publish', 'delete']);
    const publish = client.send.mock.calls[0][0] as SendMessageCommand;
    expect(publish.input.MessageGroupId).toBe(command.osId);
    expect(publish.input.MessageDeduplicationId).toBe(command.commandId);
  });

  it('keeps the message when publishing the persisted result fails', async () => {
    const client = {
      send: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockRejectedValue(new Error('SQS unavailable')),
    };
    const handler = {
      processSagaCommand: jest.fn().mockResolvedValue({
        ...command,
        type: 'SAGA_STEP_RESULT',
        outcome: 'CONCLUIDA',
        payload: {},
      }),
    };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({
        sqs: {
          enabled: true,
          region: 'us-east-1',
          endpoint: undefined,
          commandQueueUrl: 'commands',
          resultsQueueUrl: 'results',
          pollIntervalMs: 1000,
        },
      }),
    );

    await expect(
      consumer.processMessage({
        Body: JSON.stringify(command),
        MessageId: 'sqs-message-id',
        ReceiptHandle: 'receipt',
      }),
    ).rejects.toThrow('SQS unavailable');
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(SendMessageCommand);
  });

  it('does not acknowledge an invalid command so SQS can redrive it', async () => {
    const client = { send: jest.fn() };
    const handler = { processSagaCommand: jest.fn() };
    const consumer = new SagaCommandConsumer(
      client as unknown as SQSClient,
      handler as never,
      new ConfigService({ sqs: { enabled: true } }),
    );

    await consumer.processMessage({
      Body: JSON.stringify({ ...command, schemaVersion: 99 }),
      MessageId: 'invalid-message',
      ReceiptHandle: 'receipt',
    });

    expect(handler.processSagaCommand).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });
});
