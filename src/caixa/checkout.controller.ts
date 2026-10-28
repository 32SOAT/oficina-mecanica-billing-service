import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CaixaService } from './caixa.service';
import { paginaCheckout } from './checkout-page';

type DadosDoCartao = {
  token?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  installments?: number;
  payer?: { email?: string };
};

@ApiTags('Pagamento')
@Controller('pagamentos')
export class CheckoutController {
  constructor(private readonly caixa: CaixaService) {}

  @Get(':osId/checkout')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async checkout(
    @Param('osId', ParseUUIDPipe) osId: string,
    @Res() response: Response,
  ): Promise<void> {
    const pagamento = await this.caixa.consultarPagamento(osId);
    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY ?? '';
    if (pagamento.status !== 'APROVADO' && !publicKey) {
      throw new ServiceUnavailableException(
        'MERCADOPAGO_PUBLIC_KEY não está configurada no billing',
      );
    }
    response.type('html').send(
      paginaCheckout({
        osId,
        valor: Number(pagamento.valorTotal).toFixed(2),
        publicKey,
        status: pagamento.status,
        aguardandoRetorno:
          pagamento.status === 'PENDENTE' &&
          Boolean(pagamento.mercadoPagoOrderId),
      }),
    );
  }

  @Post(':osId/cobrar')
  async cobrar(
    @Param('osId', ParseUUIDPipe) osId: string,
    @Body() body: DadosDoCartao,
  ) {
    const token = body.token;
    const paymentMethodId = body.payment_method_id;
    const payerEmail = body.payer?.email;
    if (!token || !paymentMethodId || !payerEmail) {
      throw new BadRequestException(
        'Token do cartão, meio de pagamento e e-mail são obrigatórios',
      );
    }
    return this.caixa.cobrar(osId, {
      token,
      paymentMethodId,
      installments: body.installments ?? 1,
      payerEmail,
      paymentType: body.payment_type_id ?? 'credit_card',
    });
  }
}
