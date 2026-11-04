import { statusLocalDaOrder } from './mercado-pago-order';

describe('statusLocalDaOrder', () => {
  it('approves a processed order', () => {
    expect(statusLocalDaOrder({ id: 'ord', status: 'processed' })).toBe(
      'APROVADO',
    );
  });

  it('approves when the payment detail is accredited', () => {
    expect(
      statusLocalDaOrder({
        id: 'ord',
        status: 'action_required',
        paymentStatusDetail: 'accredited',
      }),
    ).toBe('APROVADO');
  });

  it('refuses a rejected card', () => {
    expect(
      statusLocalDaOrder({
        id: 'ord',
        paymentStatus: 'failed',
        paymentStatusDetail: 'cc_rejected_other_reason',
      }),
    ).toBe('RECUSADO');
  });

  it('keeps an unfinished order pending', () => {
    expect(statusLocalDaOrder({ id: 'ord', status: 'action_required' })).toBe(
      'PENDENTE',
    );
  });
});
