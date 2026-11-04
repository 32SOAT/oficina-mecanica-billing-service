import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaixaController } from './caixa.controller';
import { CaixaService } from './caixa.service';
import { CheckoutController } from './checkout.controller';
import { MercadoPagoClient } from './mercado-pago.client';
import { MERCADO_PAGO_ORDERS } from './mercado-pago-order';
import { OrcamentoEntity } from './orcamento.entity';
import { PagamentoConsultaAgendada } from './pagamento-consulta';
import { PagamentoEntity } from './pagamento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrcamentoEntity, PagamentoEntity])],
  controllers: [CaixaController, CheckoutController],
  providers: [
    CaixaService,
    PagamentoConsultaAgendada,
    MercadoPagoClient,
    { provide: MERCADO_PAGO_ORDERS, useExisting: MercadoPagoClient },
  ],
})
export class CaixaModule {}
