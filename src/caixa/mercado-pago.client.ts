import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CriarOrderInput, OrderCriada } from './mercado-pago-order';

type OrderApi = {
  id?: string;
  status?: string;
  status_detail?: string;
  message?: string;
  transactions?: {
    payments?: Array<{ status?: string; status_detail?: string }>;
  };
};

@Injectable()
export class MercadoPagoClient {
  async criarOrder(input: CriarOrderInput): Promise<OrderCriada> {
    const accessToken = this.accessToken();
    let response: Response;
    try {
      response = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          type: 'online',
          processing_mode: 'automatic',
          total_amount: input.valor,
          external_reference: input.osId,
          payer: { email: input.payerEmail },
          transactions: {
            payments: [
              {
                amount: input.valor,
                payment_method: {
                  id: input.paymentMethodId,
                  type: input.paymentType,
                  token: input.token,
                  installments: input.installments,
                },
              },
            ],
          },
        }),
      });
    } catch {
      throw new BadGatewayException('Mercado Pago indisponível');
    }

    const body = (await response.json()) as OrderApi;
    if (!response.ok || !body.id) {
      throw new BadGatewayException(
        body.message ?? `Mercado Pago recusou a order (${response.status})`,
      );
    }

    return this.paraOrder(body);
  }

  async consultarOrder(orderId: string): Promise<OrderCriada> {
    const accessToken = this.accessToken();
    let response: Response;
    try {
      response = await fetch(
        `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch {
      throw new BadGatewayException('Mercado Pago indisponível');
    }

    const body = (await response.json()) as OrderApi;
    if (!response.ok || !body.id) {
      throw new BadGatewayException(
        body.message ?? `Mercado Pago recusou a consulta (${response.status})`,
      );
    }
    return this.paraOrder(body);
  }

  private accessToken(): string {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? '';
    if (!accessToken) {
      throw new ServiceUnavailableException(
        'MERCADOPAGO_ACCESS_TOKEN não está configurado no billing',
      );
    }
    return accessToken;
  }

  private paraOrder(body: OrderApi): OrderCriada {
    const payment = body.transactions?.payments?.[0];
    return {
      id: body.id ?? '',
      status: body.status,
      statusDetail: body.status_detail,
      paymentStatus: payment?.status,
      paymentStatusDetail: payment?.status_detail,
    };
  }
}
