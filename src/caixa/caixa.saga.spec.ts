import { CaixaService } from './caixa.service';
import { OrcamentoEntity } from './orcamento.entity';
import { PagamentoEntity } from './pagamento.entity';
import { SagaCommandEntity } from '../saga/saga-command.entity';
import { SagaCommandMessage } from '../saga/saga-message';

const command = (
  overrides: Partial<SagaCommandMessage> = {},
): SagaCommandMessage =>
  ({
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
    ...overrides,
  }) as SagaCommandMessage;

function createTransactionContext() {
  const rows = new Map<unknown, Array<Record<string, unknown>>>([
    [OrcamentoEntity, []],
    [PagamentoEntity, []],
    [SagaCommandEntity, []],
  ]);
  const repositoryFor = (entity: unknown) => {
    const table = rows.get(entity)!;
    return {
      findOne: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          table.find((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ) ?? null,
        ),
      ),
      create: jest.fn((row: Record<string, unknown>) => row),
      save: jest.fn((row: Record<string, unknown>) => {
        const index = table.findIndex((stored) =>
          Object.entries(row).some(
            ([key, value]) => key === 'commandId' && stored[key] === value,
          ),
        );
        if (index >= 0) table[index] = row;
        else table.push(row);
        return Promise.resolve(row);
      }),
    };
  };
  const transactionManager = {
    getRepository: jest.fn(repositoryFor),
  };
  const dataSource = {
    transaction: jest.fn(
      (work: (manager: typeof transactionManager) => unknown) =>
        Promise.resolve(work(transactionManager)),
    ),
  };
  return { rows, manager: transactionManager, dataSource };
}

describe('CaixaService Saga commands', () => {
  it('persists the command result and quote in one transaction, then reuses it on duplicate', async () => {
    const context = createTransactionContext();
    const service = new CaixaService(
      {} as never,
      {} as never,
      { criarOrder: jest.fn(), consultarOrder: jest.fn() },
      context.dataSource as never,
    );

    const first = await service.processSagaCommand(command());
    const duplicate = await service.processSagaCommand(command());

    expect(first.outcome).toBe('CONCLUIDA');
    expect(duplicate).toEqual(first);
    expect(context.rows.get(OrcamentoEntity)).toHaveLength(1);
    expect(context.rows.get(SagaCommandEntity)).toHaveLength(1);
    expect(context.dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('records a non-retryable failure instead of overwriting a quote with another total', async () => {
    const context = createTransactionContext();
    const service = new CaixaService(
      {} as never,
      {} as never,
      { criarOrder: jest.fn(), consultarOrder: jest.fn() },
      context.dataSource as never,
    );

    await service.processSagaCommand(command());
    const result = await service.processSagaCommand(
      command({
        commandId: '00000000-0000-4000-8000-000000000005',
        type: 'BILLING_QUOTE_GENERATE',
        payload: { valorTotal: 999 },
      }),
    );

    expect(result.outcome).toBe('FALHA');
    if (result.outcome === 'FALHA')
      expect(result.payload.retryable).toBe(false);
    expect(context.rows.get(OrcamentoEntity)).toHaveLength(1);
    expect(context.rows.get(OrcamentoEntity)?.[0].valorTotal).toBe(123.45);
  });

  it('rejects reuse of a commandId with a different semantic command', async () => {
    const context = createTransactionContext();
    const service = new CaixaService(
      {} as never,
      {} as never,
      { criarOrder: jest.fn(), consultarOrder: jest.fn() },
      context.dataSource as never,
    );

    await service.processSagaCommand(command());
    await expect(
      service.processSagaCommand(command({ payload: { valorTotal: 500 } })),
    ).rejects.toThrow('commandId reutilizado com conteúdo diferente');
  });

  it('does not allow a new approval command to reverse a rejected quote', async () => {
    const context = createTransactionContext();
    const service = new CaixaService(
      {} as never,
      {} as never,
      { criarOrder: jest.fn(), consultarOrder: jest.fn() },
      context.dataSource as never,
    );

    await service.processSagaCommand(command());
    await service.processSagaCommand(
      command({
        commandId: '00000000-0000-4000-8000-000000000008',
        type: 'BILLING_QUOTE_REJECT',
        payload: {},
      }),
    );
    const result = await service.processSagaCommand(
      command({
        commandId: '00000000-0000-4000-8000-000000000009',
        type: 'BILLING_QUOTE_APPROVE',
        payload: {},
      }),
    );

    expect(result.outcome).toBe('FALHA');
    expect(context.rows.get(OrcamentoEntity)?.[0].status).toBe('REPROVADO');
  });

  it('does not overwrite an existing payment total', async () => {
    const context = createTransactionContext();
    const service = new CaixaService(
      {} as never,
      {} as never,
      { criarOrder: jest.fn(), consultarOrder: jest.fn() },
      context.dataSource as never,
    );

    await service.processSagaCommand(
      command({
        type: 'BILLING_PAYMENT_OPEN',
        payload: { valorTotal: 123.45 },
      }),
    );
    const result = await service.processSagaCommand(
      command({
        commandId: '00000000-0000-4000-8000-00000000000a',
        type: 'BILLING_PAYMENT_OPEN',
        payload: { valorTotal: 999 },
      }),
    );

    expect(result.outcome).toBe('FALHA');
    expect(context.rows.get(PagamentoEntity)).toHaveLength(1);
    expect(context.rows.get(PagamentoEntity)?.[0].valorTotal).toBe(123.45);
  });
});
