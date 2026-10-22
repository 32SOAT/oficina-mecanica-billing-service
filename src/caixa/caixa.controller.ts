import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SagaTokenGuard } from '../saga/saga-token.guard';
import { CaixaService } from './caixa.service';

type ValorDaOs = {
  osId: string;
  valorTotal: number;
};

@ApiTags('Caixa')
@UseGuards(SagaTokenGuard)
@Controller()
export class CaixaController {
  constructor(private readonly caixa: CaixaService) {}

  @Post('orcamentos')
  gerar(@Body() dto: ValorDaOs) {
    return this.caixa.gerarOrcamento(dto.osId, dto.valorTotal);
  }

  @Post('orcamentos/:osId/aprovar')
  aprovar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.aprovarOrcamento(osId);
  }

  @Post('orcamentos/:osId/reprovar')
  reprovar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.reprovarOrcamento(osId);
  }

  @Get('orcamentos/:osId')
  consultarOrcamento(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.consultarOrcamento(osId);
  }

  @Post('pagamentos')
  abrir(@Body() dto: ValorDaOs) {
    return this.caixa.abrirPagamento(dto.osId, dto.valorTotal);
  }

  @Post('pagamentos/:osId/confirmar')
  confirmar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.confirmarPagamento(osId);
  }

  @Post('pagamentos/:osId/recusar')
  recusar(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.recusarPagamento(osId);
  }

  @Get('pagamentos/:osId')
  consultarPagamento(@Param('osId', ParseUUIDPipe) osId: string) {
    return this.caixa.consultarPagamento(osId);
  }
}
