import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CriarOrderInput,
  MERCADO_PAGO_ORDERS,
  MercadoPagoOrders,
  statusLocalDaOrder,
} from './mercado-pago-order';
import { OrcamentoEntity, StatusOrcamento } from './orcamento.entity';
import { PagamentoEntity, StatusPagamento } from './pagamento.entity';

@Injectable()
export class CaixaService {
  private readonly logger = new Logger(CaixaService.name);

  constructor(
    @InjectRepository(OrcamentoEntity)
    private readonly orcamentos: Repository<OrcamentoEntity>,
    @InjectRepository(PagamentoEntity)
    private readonly pagamentos: Repository<PagamentoEntity>,
    @Inject(MERCADO_PAGO_ORDERS)
    private readonly mercadoPago: MercadoPagoOrders,
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

  async cobrar(
    osId: string,
    cobranca: Omit<CriarOrderInput, 'osId' | 'valor'>,
  ): Promise<PagamentoEntity> {
    const pagamento = await this.consultarPagamento(osId);
    if (pagamento.status === 'APROVADO') return pagamento;
    const order = await this.mercadoPago.criarOrder({
      osId,
      valor: Number(pagamento.valorTotal).toFixed(2),
      ...cobranca,
    });
    pagamento.mercadoPagoOrderId = order.id;
    pagamento.status = statusLocalDaOrder(order);
    return this.pagamentos.save(pagamento);
  }

  async consultarPagamento(osId: string): Promise<PagamentoEntity> {
    const pagamento = await this.pagamentos.findOne({ where: { osId } });
    if (!pagamento) throw new NotFoundException('Pagamento não encontrado');
    if (pagamento.status === 'PENDENTE' && pagamento.mercadoPagoOrderId) {
      await this.atualizarPeloMercadoPago(pagamento);
    }
    return pagamento;
  }

  async sincronizarPagamentosPendentes(): Promise<void> {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return;
    const pendentes = await this.pagamentos.find({
      where: { status: 'PENDENTE' },
    });
    for (const pagamento of pendentes) {
      if (!pagamento.mercadoPagoOrderId) continue;
      await this.atualizarPeloMercadoPago(pagamento);
    }
  }

  private async atualizarPeloMercadoPago(
    pagamento: PagamentoEntity,
  ): Promise<void> {
    if (!pagamento.mercadoPagoOrderId || pagamento.status !== 'PENDENTE') {
      return;
    }
    try {
      const order = await this.mercadoPago.consultarOrder(
        pagamento.mercadoPagoOrderId,
      );
      const status = statusLocalDaOrder(order);
      if (status === pagamento.status) return;
      pagamento.status = status;
      await this.pagamentos.save(pagamento);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro';
      this.logger.warn(
        `Não foi possível consultar a order ${pagamento.mercadoPagoOrderId}: ${message}`,
      );
    }
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
