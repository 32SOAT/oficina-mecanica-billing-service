import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaixaController } from './caixa.controller';
import { CaixaService } from './caixa.service';
import { OrcamentoEntity } from './orcamento.entity';
import { PagamentoEntity } from './pagamento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrcamentoEntity, PagamentoEntity])],
  controllers: [CaixaController],
  providers: [CaixaService],
})
export class CaixaModule {}
