import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrcamentoEntity, StatusOrcamento } from './orcamento.entity';
import { PagamentoEntity, StatusPagamento } from './pagamento.entity';

@Injectable()
export class CaixaService {
  constructor(
    @InjectRepository(OrcamentoEntity)
    private readonly orcamentos: Repository<OrcamentoEntity>,
    @InjectRepository(PagamentoEntity)
    private readonly pagamentos: Repository<PagamentoEntity>,
  ) {}

  async gerarOrcamento(
    osId: string,
    valorTotal: number,
  ): Promise<OrcamentoEntity> {
    const existente = await this.orcamentos.findOne({ where: { osId } });
    if (existente) return existente;
    return this.orcamentos.save(
      this.orcamentos.create({ osId, valorTotal, status: 'GERADO' }),
    );
  }

  async aprovarOrcamento(osId: string): Promise<OrcamentoEntity> {
    return this.mudarOrcamento(osId, 'APROVADO', 'REPROVADO');
  }

  async reprovarOrcamento(osId: string): Promise<OrcamentoEntity> {
    return this.mudarOrcamento(osId, 'REPROVADO', 'APROVADO');
  }

  async consultarOrcamento(osId: string): Promise<OrcamentoEntity> {
    const orcamento = await this.orcamentos.findOne({ where: { osId } });
    if (!orcamento) throw new NotFoundException('Orçamento não encontrado');
    return orcamento;
  }

  async abrirPagamento(
    osId: string,
    valorTotal: number,
  ): Promise<PagamentoEntity> {
    const existente = await this.pagamentos.findOne({ where: { osId } });
    if (existente) return existente;
    return this.pagamentos.save(
      this.pagamentos.create({ osId, valorTotal, status: 'PENDENTE' }),
    );
  }

  async confirmarPagamento(osId: string): Promise<PagamentoEntity> {
    return this.mudarPagamento(osId, 'APROVADO', 'RECUSADO');
  }

  async recusarPagamento(osId: string): Promise<PagamentoEntity> {
    return this.mudarPagamento(osId, 'RECUSADO', 'APROVADO');
  }

  async consultarPagamento(osId: string): Promise<PagamentoEntity> {
    const pagamento = await this.pagamentos.findOne({ where: { osId } });
    if (!pagamento) throw new NotFoundException('Pagamento não encontrado');
    return pagamento;
  }

  private async mudarOrcamento(
    osId: string,
    status: StatusOrcamento,
    bloqueado: StatusOrcamento,
  ): Promise<OrcamentoEntity> {
    const orcamento = await this.consultarOrcamento(osId);
    if (orcamento.status === bloqueado) {
      throw new BadRequestException(
        `Orçamento não pode ir para ${status} depois de ${bloqueado}`,
      );
    }
    orcamento.status = status;
    return this.orcamentos.save(orcamento);
  }

  private async mudarPagamento(
    osId: string,
    status: StatusPagamento,
    bloqueado: StatusPagamento,
  ): Promise<PagamentoEntity> {
    const pagamento = await this.consultarPagamento(osId);
    if (pagamento.status === bloqueado) {
      throw new BadRequestException(
        `Pagamento não pode ir para ${status} depois de ${bloqueado}`,
      );
    }
    pagamento.status = status;
    return this.pagamentos.save(pagamento);
  }
}
