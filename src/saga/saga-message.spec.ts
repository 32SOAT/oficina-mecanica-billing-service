import { isSagaCommandMessage, SagaCommandMessage } from './saga-message';

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

describe('Billing Saga command contract', () => {
  it('accepts a valid versioned Billing command', () => {
    expect(isSagaCommandMessage(command)).toBe(true);
  });

  it('rejects unknown schema versions, unsupported commands, and invalid payloads', () => {
    expect(isSagaCommandMessage({ ...command, schemaVersion: 2 })).toBe(false);
    expect(isSagaCommandMessage({ ...command, type: 'EXECUTION_OPEN' })).toBe(
      false,
    );
    expect(
      isSagaCommandMessage({ ...command, payload: { valorTotal: -1 } }),
    ).toBe(false);
    expect(
      isSagaCommandMessage({
        ...command,
        payload: { valorTotal: 100, extra: 1 },
      }),
    ).toBe(false);
  });
});
