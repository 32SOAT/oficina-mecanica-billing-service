import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CaixaService } from './caixa.service';

function respostaHtml(): {
  type: jest.Mock;
  send: jest.Mock;
  html: () => string;
} {
  let corpo = '';
  return {
    type: jest.fn().mockReturnThis(),
    send: jest.fn((body: string) => {
      corpo = body;
    }),
    html: () => corpo,
  };
}

describe('CheckoutController', () => {
  const caixa = {
    consultarPagamento: jest.fn(),
    cobrar: jest.fn(),
  };
  const controller = new CheckoutController(caixa as unknown as CaixaService);

  beforeEach(() => {
    process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-public';
  });

  it('renders the card form for a pending payment', async () => {
    caixa.consultarPagamento.mockResolvedValue({
      valorTotal: '48.5',
      status: 'PENDENTE',
    });
    const response = respostaHtml();

    await controller.checkout(
      '11111111-1111-4111-8111-111111111111',
      response as never,
    );

    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.html()).toContain('cardPayment');
    expect(response.html()).toContain('<p id="resultado"></p>');
  });

  it('says the payment is waiting when Mercado Pago has not answered yet', async () => {
    caixa.consultarPagamento.mockResolvedValue({
      valorTotal: '48.5',
      status: 'PENDENTE',
      mercadoPagoOrderId: 'ORD01',
    });
    const response = respostaHtml();

    await controller.checkout(
      '11111111-1111-4111-8111-111111111111',
      response as never,
    );

    expect(response.html()).toContain(
      '<p id="resultado">Pagamento pendente. Aguardando o retorno do Mercado Pago.</p>',
    );
    expect(response.html()).toContain('cardPayment');
  });

  it('rejects a charge without the card token', async () => {
    await expect(
      controller.cobrar('11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('charges with the brick payload', async () => {
    caixa.cobrar.mockResolvedValue({ status: 'APROVADO' });
    await expect(
      controller.cobrar('11111111-1111-4111-8111-111111111111', {
        token: 'tok',
        payment_method_id: 'visa',
        payer: { email: 'cliente@example.com' },
      }),
    ).resolves.toEqual({ status: 'APROVADO' });
  });

  it('keeps the card form and asks for another try when payment was refused', async () => {
    caixa.consultarPagamento.mockResolvedValue({
      valorTotal: '48.5',
      status: 'RECUSADO',
      mercadoPagoOrderId: 'ORD02',
    });
    const response = respostaHtml();

    await controller.checkout(
      '11111111-1111-4111-8111-111111111111',
      response as never,
    );

    expect(response.html()).toContain(
      '<p id="resultado">Pagamento recusado. Tente novamente.</p>',
    );
    expect(response.html()).toContain('cardPayment');
  });

  it('hides the card form when the payment is already approved', async () => {
    caixa.consultarPagamento.mockResolvedValue({
      valorTotal: '48.5',
      status: 'APROVADO',
    });
    const response = respostaHtml();

    await controller.checkout(
      '11111111-1111-4111-8111-111111111111',
      response as never,
    );

    expect(response.html()).toContain('já está paga');
    expect(response.html()).not.toContain('cardPayment');
  });

  it('refuses the page when the public key is missing', async () => {
    caixa.consultarPagamento.mockResolvedValue({
      valorTotal: '48.5',
      status: 'PENDENTE',
    });
    delete process.env.MERCADOPAGO_PUBLIC_KEY;
    await expect(
      controller.checkout('11111111-1111-4111-8111-111111111111', {} as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
