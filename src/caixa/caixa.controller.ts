import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SagaTokenGuard } from '../saga/saga-token.guard';
import { CaixaService } from './caixa.service';
import {
  ApiCaixaDataResponse,
  OrcamentoOpenApiDto,
  PagamentoOpenApiDto,
  ValorDaOsRequestDto,
} from './caixa.openapi';

type ValorDaOs = { osId: string; valorTotal: number };

@ApiTags('Billing interno')
@ApiSecurity('SagaToken')
@UseGuards(SagaTokenGuard)
@Controller()
export class CaixaController {
  constructor(private readonly caixa: CaixaService) {}

  @Post('orcamentos')
  @ApiOperation({
    summary: 'Gerar orçamento por HTTP (legado)',
    description:
      'A orquestração atual envia BILLING_QUOTE_GENERATE pela fila SQS do Billing. Esta rota HTTP interna foi mantida para compatibilidade e não é usada pela OS.',
    deprecated: true,
  })
  @ApiBody({ type: ValorDaOsRequestDto })
  @ApiCaixaDataResponse(OrcamentoOpenApiDto, 'Orçamento gerado (legado)', 201)
  gerar(@Body() dto: ValorDaOs) {
    return this.caixa.gerarOrcamento(dto.osId, dto.valorTotal);
  }

  @Post('orcamentos/:osId/aprovar')
  @ApiOperation({
    summary: 'Aprovar orçamento por HTTP (legado)',
    description:
      'A orquestração atual envia BILLING_QUOTE_APPROVE pela fila SQS do Billing.',
    deprecated: true,
  })
  @ApiCaixaDataResponse(OrcamentoOpenApiDto, 'Orçamento aprovado (legado)', 201)
  aprovar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.aprovarOrcamento(osId);
  }

  @Post('orcamentos/:osId/reprovar')
  @ApiOperation({
    summary: 'Reprovar orçamento por HTTP (legado)',
    description:
      'A orquestração atual envia BILLING_QUOTE_REJECT pela fila SQS do Billing.',
    deprecated: true,
  })
  @ApiCaixaDataResponse(
    OrcamentoOpenApiDto,
    'Orçamento reprovado (legado)',
    201,
  )
  reprovar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.reprovarOrcamento(osId);
  }

  @Get('orcamentos/:osId')
  @ApiOperation({
    summary: 'Consultar orçamento por HTTP (legado interno)',
    description: 'A OS recebe os resultados de orçamento pela fila SQS.',
    deprecated: true,
  })
  @ApiCaixaDataResponse(OrcamentoOpenApiDto, 'Orçamento consultado')
  @ApiNotFoundResponse({ description: 'Orçamento não encontrado.' })
  consultarOrcamento(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.consultarOrcamento(osId);
  }

  @Post('pagamentos')
  @ApiOperation({
    summary: 'Abrir pagamento por HTTP (legado)',
    description:
      'A Saga atual envia BILLING_PAYMENT_OPEN pela fila SQS. A abertura cria somente o pagamento local pendente; a cobrança continua no checkout.',
    deprecated: true,
  })
  @ApiBody({ type: ValorDaOsRequestDto })
  @ApiCaixaDataResponse(PagamentoOpenApiDto, 'Pagamento aberto (legado)', 201)
  abrir(@Body() dto: ValorDaOs) {
    return this.caixa.abrirPagamento(dto.osId, dto.valorTotal);
  }

  @Post('pagamentos/:osId/confirmar')
  @ApiOperation({
    summary: 'Confirmar pagamento por HTTP (legado)',
    description:
      'Não usado pelo fluxo de checkout atual; o Billing atualiza o pagamento a partir do retorno do Mercado Pago.',
    deprecated: true,
  })
  @ApiCaixaDataResponse(
    PagamentoOpenApiDto,
    'Pagamento confirmado (legado)',
    201,
  )
  confirmar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.confirmarPagamento(osId);
  }

  @Post('pagamentos/:osId/recusar')
  @ApiOperation({
    summary: 'Recusar pagamento por HTTP (legado)',
    description:
      'Não usado pelo fluxo de checkout atual; o Billing atualiza o pagamento a partir do retorno do Mercado Pago.',
    deprecated: true,
  })
  @ApiCaixaDataResponse(PagamentoOpenApiDto, 'Pagamento recusado (legado)', 201)
  recusar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.recusarPagamento(osId);
  }

  @Get('pagamentos/:osId')
  @ApiOperation({
    summary: 'Consultar pagamento para a entrega da OS',
    description:
      'Consulta síncrona usada pela OS. Exige o header interno x-saga-token; a entrega só é liberada quando o status é APROVADO.',
  })
  @ApiCaixaDataResponse(PagamentoOpenApiDto, 'Pagamento consultado')
  @ApiNotFoundResponse({ description: 'Pagamento não encontrado.' })
  consultarPagamento(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.consultarPagamento(osId);
  }
}
