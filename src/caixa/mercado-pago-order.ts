import { StatusPagamento } from './pagamento.entity';

export type OrderCriada = {
  id: string;
  status?: string;
  statusDetail?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
};

export type CriarOrderInput = {
  osId: string;
  valor: string;
  token: string;
  paymentMethodId: string;
  installments: number;
  payerEmail: string;
  paymentType: string;
};

export interface MercadoPagoOrders {
  criarOrder(input: CriarOrderInput): Promise<OrderCriada>;
  consultarOrder(orderId: string): Promise<OrderCriada>;
}

export const MERCADO_PAGO_ORDERS = Symbol('MERCADO_PAGO_ORDERS');

export function statusLocalDaOrder(order: OrderCriada): StatusPagamento {
  const status = order.paymentStatus ?? order.status;
  const detalhe = order.paymentStatusDetail ?? order.statusDetail ?? '';
  if (
    status === 'processed' ||
    status === 'approved' ||
    detalhe === 'accredited'
  ) {
    return 'APROVADO';
  }
  if (
    status === 'failed' ||
    status === 'rejected' ||
    status === 'canceled' ||
    status === 'cancelled' ||
    detalhe.startsWith('cc_rejected') ||
    detalhe === 'rejected'
  ) {
    return 'RECUSADO';
  }
  return 'PENDENTE';
}
