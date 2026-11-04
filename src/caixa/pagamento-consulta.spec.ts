import { PagamentoConsultaAgendada } from './pagamento-consulta';
import { CaixaService } from './caixa.service';

describe('PagamentoConsultaAgendada', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.MERCADOPAGO_POLL_INTERVAL_MS;
  });

  it('consults on startup and on each interval', () => {
    jest.useFakeTimers();
    process.env.MERCADOPAGO_POLL_INTERVAL_MS = '5000';
    const caixa = {
      sincronizarPagamentosPendentes: jest.fn().mockResolvedValue(undefined),
    };
    const job = new PagamentoConsultaAgendada(caixa as unknown as CaixaService);

    job.onModuleInit();
    expect(caixa.sincronizarPagamentosPendentes).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(caixa.sincronizarPagamentosPendentes).toHaveBeenCalledTimes(2);

    job.onModuleDestroy();
    jest.advanceTimersByTime(5000);
    expect(caixa.sincronizarPagamentosPendentes).toHaveBeenCalledTimes(2);
  });

  it('uses ten minutes when the interval is invalid', () => {
    jest.useFakeTimers();
    process.env.MERCADOPAGO_POLL_INTERVAL_MS = '1';
    const caixa = {
      sincronizarPagamentosPendentes: jest.fn().mockResolvedValue(undefined),
    };
    const job = new PagamentoConsultaAgendada(caixa as unknown as CaixaService);

    job.onModuleInit();
    jest.advanceTimersByTime(599999);
    expect(caixa.sincronizarPagamentosPendentes).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    expect(caixa.sincronizarPagamentosPendentes).toHaveBeenCalledTimes(2);
    job.onModuleDestroy();
  });
});
