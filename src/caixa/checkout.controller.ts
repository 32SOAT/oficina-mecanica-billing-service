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
import {
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CaixaService } from './caixa.service';
import { paginaCheckout } from './checkout-page';
import { ApiCaixaDataResponse, PagamentoOpenApiDto } from './caixa.openapi';

class PagadorCheckoutDto {
  @ApiProperty({ format: 'email', example: 'cliente@example.com' })
  email: string;
}

class DadosDoCartaoDto {
  @ApiProperty({
    description: 'Token do cartão produzido pelo Mercado Pago Brick.',
  })
  token: string;

  @ApiProperty({ example: 'visa' })
  payment_method_id: string;

  @ApiPropertyOptional({ example: 'credit_card', default: 'credit_card' })
  payment_type_id?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  installments?: number;

  @ApiProperty({ type: PagadorCheckoutDto })
  payer: PagadorCheckoutDto;
}

@ApiTags('Pagamento')
@Controller('pagamentos')
export class CheckoutController {
  constructor(private readonly caixa: CaixaService) {}

  @Get(':osId/checkout')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Abrir página pública de checkout da OS' })
  @ApiResponse({
    status: 200,
    description: 'Página HTML do checkout.',
    content: { 'text/html': { schema: { type: 'string' } } },
  })
  @ApiResponse({
    status: 503,
    description: 'Public Key do Mercado Pago ausente.',
  })
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
  @ApiOperation({
    summary: 'Cobrar a OS com token de cartão',
    description:
      'Recebe o token gerado pelo Mercado Pago Brick, cria uma order no provedor e persiste o status no Billing. O cliente não envia o valor da cobrança.',
  })
  @ApiBody({ type: DadosDoCartaoDto })
  @ApiCaixaDataResponse(
    PagamentoOpenApiDto,
    'Pagamento atualizado com o retorno do provedor',
    201,
  )
  @ApiResponse({
    status: 400,
    description: 'Dados obrigatórios da cobrança ausentes.',
  })
  @ApiResponse({
    status: 502,
    description: 'Falha na comunicação com o provedor de pagamento.',
  })
  async cobrar(
    @Param('osId', ParseUUIDPipe) osId: string,
    @Body() body: Partial<DadosDoCartaoDto>,
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
