import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MercadoPagoClient } from './mercado-pago.client';

describe('MercadoPagoClient', () => {
  const client = new MercadoPagoClient();

  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-test';
    jest.restoreAllMocks();
  });

  it('creates an order and reads the payment status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          id: 'ORD01',
          status: 'processed',
          status_detail: 'accredited',
          transactions: {
            payments: [{ status: 'processed', status_detail: 'accredited' }],
          },
        }),
    } as Response);

    await expect(
      client.criarOrder({
        osId: 'os-1',
        valor: '10.00',
        token: 'tok',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'cliente@example.com',
        paymentType: 'credit_card',
      }),
    ).resolves.toEqual({
      id: 'ORD01',
      status: 'processed',
      statusDetail: 'accredited',
      paymentStatus: 'processed',
      paymentStatusDetail: 'accredited',
    });
  });

  it('reports a refused order', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'token inválido' }),
    } as Response);

    await expect(
      client.criarOrder({
        osId: 'os-1',
        valor: '10.00',
        token: 'tok',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'cliente@example.com',
        paymentType: 'credit_card',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('refuses to call Mercado Pago without the access token', async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    await expect(
      client.criarOrder({
        osId: 'os-1',
        valor: '10.00',
        token: 'tok',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'cliente@example.com',
        paymentType: 'credit_card',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reads an existing order', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 'ORD02',
          status: 'processed',
          status_detail: 'accredited',
        }),
    } as Response);

    await expect(client.consultarOrder('ORD02')).resolves.toEqual({
      id: 'ORD02',
      status: 'processed',
      statusDetail: 'accredited',
      paymentStatus: undefined,
      paymentStatusDetail: undefined,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.mercadopago.com/v1/orders/ORD02',
    );
  });

  it('reports when Mercado Pago cannot be reached', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(
      client.criarOrder({
        osId: 'os-1',
        valor: '10.00',
        token: 'tok',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'cliente@example.com',
        paymentType: 'credit_card',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
