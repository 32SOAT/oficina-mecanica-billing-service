import { CaixaController } from './caixa.controller';
import { CaixaService } from './caixa.service';

describe('CaixaController', () => {
  const caixa = {
    gerarOrcamento: jest.fn(),
    aprovarOrcamento: jest.fn(),
    reprovarOrcamento: jest.fn(),
    consultarOrcamento: jest.fn(),
    abrirPagamento: jest.fn(),
    confirmarPagamento: jest.fn(),
    recusarPagamento: jest.fn(),
    consultarPagamento: jest.fn(),
  };
  const controller = new CaixaController(caixa as unknown as CaixaService);

  it('delegates quote and payment actions', async () => {
    await controller.gerar({ osId: 'os-1', valorTotal: 10 });
    await controller.aprovar('os-1');
    await controller.reprovar('os-1');
    await controller.consultarOrcamento('os-1');
    await controller.abrir({ osId: 'os-1', valorTotal: 10 });
    await controller.confirmar('os-1');
    await controller.recusar('os-1');
    await controller.consultarPagamento('os-1');

    expect(caixa.gerarOrcamento).toHaveBeenCalledWith('os-1', 10);
    expect(caixa.confirmarPagamento).toHaveBeenCalledWith('os-1');
    expect(caixa.recusarPagamento).toHaveBeenCalledWith('os-1');
  });
});
