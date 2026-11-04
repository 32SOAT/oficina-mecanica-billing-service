import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaixaService } from './caixa.service';
import { OrcamentoEntity } from './orcamento.entity';
import { PagamentoEntity } from './pagamento.entity';

function memoria<T extends { osId: string }>() {
  const rows: T[] = [];
  return {
    findOne: jest.fn(({ where }: { where: { osId: string } }) => {
      return Promise.resolve(
        rows.find((row) => row.osId === where.osId) ?? null,
      );
    }),
    find: jest.fn(({ where }: { where?: { status?: string } } = {}) => {
      return Promise.resolve(
        rows.filter(
          (row) =>
            !where?.status ||
            (row as { status?: string }).status === where.status,
        ),
      );
    }),
    create: jest.fn((input: T) => input),
    save: jest.fn((input: T) => {
      const index = rows.findIndex((row) => row.osId === input.osId);
      if (index >= 0) rows[index] = input;
      else rows.push(input);
      return Promise.resolve(input);
    }),
  };
}

describe('CaixaService', () => {
  const orcamentos = memoria<OrcamentoEntity>();
  const pagamentos = memoria<PagamentoEntity>();
  const mercadoPago = { criarOrder: jest.fn(), consultarOrder: jest.fn() };
  const service = new CaixaService(
    orcamentos as never,
    pagamentos as never,
    mercadoPago,
  );

  it('creates a quote once and approves it', async () => {
    const gerado = await service.gerarOrcamento('os-1', 80);
    const deNovo = await service.gerarOrcamento('os-1', 80);

    expect(gerado.status).toBe('GERADO');
    expect(deNovo).toBe(gerado);

    const aprovado = await service.aprovarOrcamento('os-1');
    expect(aprovado.status).toBe('APROVADO');
    expect(await service.consultarOrcamento('os-1')).toEqual(aprovado);
  });

  it('rejects a second decision after the quote was refused', async () => {
    await service.gerarOrcamento('os-2', 40);
    await service.reprovarOrcamento('os-2');

    await expect(service.aprovarOrcamento('os-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('opens a payment and confirms it', async () => {
    const aberto = await service.abrirPagamento('os-1', 80);
    const deNovo = await service.abrirPagamento('os-1', 80);

    expect(aberto.status).toBe('PENDENTE');
    expect(deNovo).toBe(aberto);

    const confirmado = await service.confirmarPagamento('os-1');
    expect(confirmado.status).toBe('APROVADO');
  });

  it('does not confirm a refused payment', async () => {
    await service.abrirPagamento('os-3', 10);
    await service.recusarPagamento('os-3');

    await expect(service.confirmarPagamento('os-3')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.consultarPagamento('os-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.consultarOrcamento('os-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('charges a pending payment through Mercado Pago', async () => {
    await service.abrirPagamento('os-4', 15);
    mercadoPago.criarOrder.mockResolvedValue({
      id: 'ord-1',
      status: 'processed',
    });

    const pago = await service.cobrar('os-4', {
      token: 'card-token',
      paymentMethodId: 'master',
      installments: 1,
      payerEmail: 'cliente@example.com',
      paymentType: 'credit_card',
    });

    expect(pago.status).toBe('APROVADO');
    expect(pago.mercadoPagoOrderId).toBe('ord-1');
    expect(mercadoPago.criarOrder).toHaveBeenCalledWith(
      expect.objectContaining({ osId: 'os-4', valor: '15.00' }),
    );
  });

  it('does not charge again when the payment is already approved', async () => {
    await service.abrirPagamento('os-5', 20);
    mercadoPago.criarOrder.mockResolvedValue({
      id: 'ord-2',
      status: 'processed',
    });
    await service.cobrar('os-5', {
      token: 'card-token',
      paymentMethodId: 'visa',
      installments: 1,
      payerEmail: 'cliente@example.com',
      paymentType: 'credit_card',
    });
    mercadoPago.criarOrder.mockClear();

    const deNovo = await service.cobrar('os-5', {
      token: 'outro-token',
      paymentMethodId: 'visa',
      installments: 1,
      payerEmail: 'cliente@example.com',
      paymentType: 'credit_card',
    });

    expect(deNovo.status).toBe('APROVADO');
    expect(mercadoPago.criarOrder).not.toHaveBeenCalled();
  });

  it('asks Mercado Pago again when a pending order changes', async () => {
    await service.abrirPagamento('os-8', 5);
    const pagamento = await service.abrirPagamento('os-6', 30);
    pagamento.mercadoPagoOrderId = 'ord-6';
    const tokenAnterior = process.env.MERCADOPAGO_ACCESS_TOKEN;
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-test';
    mercadoPago.consultarOrder.mockResolvedValue({
      id: 'ord-6',
      status: 'processed',
    });

    await service.sincronizarPagamentosPendentes();

    expect(pagamento.status).toBe('APROVADO');
    expect(mercadoPago.consultarOrder).toHaveBeenCalledWith('ord-6');
    if (tokenAnterior === undefined)
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    else process.env.MERCADOPAGO_ACCESS_TOKEN = tokenAnterior;
  });

  it('keeps the payment pending when Mercado Pago cannot be reached', async () => {
    const pagamento = await service.abrirPagamento('os-7', 12);
    pagamento.mercadoPagoOrderId = 'ord-7';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-test';
    mercadoPago.consultarOrder.mockRejectedValue(new Error('offline'));

    await service.sincronizarPagamentosPendentes();

    expect(pagamento.status).toBe('PENDENTE');
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });
});
