import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CaixaService } from './caixa.service';

@Injectable()
export class PagamentoConsultaAgendada
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PagamentoConsultaAgendada.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly caixa: CaixaService) {}

  onModuleInit(): void {
    this.consultar();
    this.timer = setInterval(this.consultar, this.intervaloMs());
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private readonly consultar = (): void => {
    void this.caixa.sincronizarPagamentosPendentes().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'erro';
      this.logger.warn(`Falha ao consultar pagamentos pendentes: ${message}`);
    });
  };

  private intervaloMs(): number {
    const valor = Number(process.env.MERCADOPAGO_POLL_INTERVAL_MS ?? 600000);
    if (!Number.isFinite(valor) || valor < 5000) return 600000;
    return valor;
  }
}
