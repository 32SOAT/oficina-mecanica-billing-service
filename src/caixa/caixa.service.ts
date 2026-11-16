import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  CriarOrderInput,
  MERCADO_PAGO_ORDERS,
  MercadoPagoOrders,
  statusLocalDaOrder,
} from './mercado-pago-order';
import { OrcamentoEntity, StatusOrcamento } from './orcamento.entity';
import { PagamentoEntity, StatusPagamento } from './pagamento.entity';
import { SagaCommandEntity } from '../saga/saga-command.entity';
import {
  SagaCommandMessage,
  SagaCommandType,
  SagaResultMessage,
} from '../saga/saga-message';
import {
  createSagaResult,
  sagaCommandFingerprint,
} from '../saga/saga-command.utils';

class SagaBusinessError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

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
    @Optional()
    @InjectDataSource()
    private readonly dataSource?: DataSource,
  ) {}

  async processSagaCommand(
    command: SagaCommandMessage,
  ): Promise<SagaResultMessage> {
    if (!this.dataSource) {
      throw new Error('DataSource indisponível para a Saga do Billing');
    }

    const fingerprint = sagaCommandFingerprint(command);
    return this.dataSource.transaction(async (manager) => {
      const commands = manager.getRepository(SagaCommandEntity);
      const existing = await commands.findOne({
        where: { commandId: command.commandId },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new Error('commandId reutilizado com conteúdo diferente');
        }
        return existing.result;
      }

      let result: SagaResultMessage;
      try {
        await this.applySagaCommand(manager, command);
        result = createSagaResult(command, {
          outcome: 'CONCLUIDA',
          payload: {},
        });
      } catch (error) {
        if (!(error instanceof SagaBusinessError)) throw error;
        result = createSagaResult(command, {
          outcome: 'FALHA',
          payload: {
            code: error.code,
            message: error.message,
            retryable: false,
          },
        });
      }

      await commands.save(
        commands.create({
          commandId: command.commandId,
          requestFingerprint: fingerprint,
          result,
        }),
      );
      return result;
    });
  }

  private async applySagaCommand(
    manager: EntityManager,
    command: SagaCommandMessage,
  ): Promise<void> {
    switch (command.type) {
      case SagaCommandType.BillingQuoteGenerate: {
        const repository = manager.getRepository(OrcamentoEntity);
        const existing = await repository.findOne({
          where: { osId: command.osId },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          this.assertSameTotal(existing.valorTotal, command.payload.valorTotal);
          if (existing.status !== 'GERADO') {
            throw new SagaBusinessError(
              'TRANSICAO_ORCAMENTO_INCOMPATIVEL',
              'Orçamento já saiu do estado de geração',
            );
          }
          return;
        }
        await repository.save(
          repository.create({
            osId: command.osId,
            valorTotal: command.payload.valorTotal,
            status: 'GERADO',
          }),
        );
        return;
      }
      case SagaCommandType.BillingQuoteApprove:
      case SagaCommandType.BillingQuoteReject: {
        const target: StatusOrcamento =
          command.type === SagaCommandType.BillingQuoteApprove
            ? 'APROVADO'
            : 'REPROVADO';
        const opposite: StatusOrcamento =
          target === 'APROVADO' ? 'REPROVADO' : 'APROVADO';
        const repository = manager.getRepository(OrcamentoEntity);
        const quote = await repository.findOne({
          where: { osId: command.osId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!quote) {
          throw new SagaBusinessError(
            'ORCAMENTO_NAO_ENCONTRADO',
            'Orçamento não encontrado para a OS',
          );
        }
        if (quote.status === opposite) {
          throw new SagaBusinessError(
            'TRANSICAO_ORCAMENTO_INCOMPATIVEL',
            'Orçamento já recebeu a decisão oposta',
          );
        }
        if (quote.status === target) return;
        if (quote.status !== 'GERADO') {
          throw new SagaBusinessError(
            'TRANSICAO_ORCAMENTO_INCOMPATIVEL',
            'Estado atual do orçamento não permite essa decisão',
          );
        }
        quote.status = target;
        await repository.save(quote);
        return;
      }
      case SagaCommandType.BillingPaymentOpen: {
        const repository = manager.getRepository(PagamentoEntity);
        const existing = await repository.findOne({
          where: { osId: command.osId },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          this.assertSameTotal(existing.valorTotal, command.payload.valorTotal);
          if (existing.status !== 'PENDENTE') {
            throw new SagaBusinessError(
              'TRANSICAO_PAGAMENTO_INCOMPATIVEL',
              'Pagamento já saiu do estado pendente',
            );
          }
          return;
        }
        await repository.save(
          repository.create({
            osId: command.osId,
            valorTotal: command.payload.valorTotal,
            status: 'PENDENTE',
            mercadoPagoOrderId: null,
          }),
        );
        return;
      }
      default:
        throw new SagaBusinessError(
          'COMANDO_NAO_SUPORTADO',
          'Comando não suportado pelo Billing',
        );
    }
  }

  private assertSameTotal(existing: number, requested: number): void {
    if (Number(existing) !== requested) {
      throw new SagaBusinessError(
        'VALOR_TOTAL_DIVERGENTE',
        'Valor total difere do registro existente',
      );
    }
  }

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
