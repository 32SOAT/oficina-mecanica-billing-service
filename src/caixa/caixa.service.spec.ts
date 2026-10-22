import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaixaService } from './caixa.service';
import { OrcamentoEntity } from './orcamento.entity';
import { PagamentoEntity } from './pagamento.entity';

function memoria<T extends { osId: string }>() {
  const rows: T[] = [];
  return {
    findOne: jest.fn(({ where }: { where: { osId: string } }) => {
      return Promise.resolve(
        rows.find((row) => row.osId === where.osId) ?? null,
      );
    }),
    create: jest.fn((input: T) => input),
    save: jest.fn((input: T) => {
      const index = rows.findIndex((row) => row.osId === input.osId);
      if (index >= 0) rows[index] = input;
      else rows.push(input);
      return Promise.resolve(input);
    }),
  };
}

describe('CaixaService', () => {
  const orcamentos = memoria<OrcamentoEntity>();
  const pagamentos = memoria<PagamentoEntity>();
  const service = new CaixaService(orcamentos as never, pagamentos as never);

  it('creates a quote once and approves it', async () => {
    const gerado = await service.gerarOrcamento('os-1', 80);
    const deNovo = await service.gerarOrcamento('os-1', 80);

    expect(gerado.status).toBe('GERADO');
    expect(deNovo).toBe(gerado);

    const aprovado = await service.aprovarOrcamento('os-1');
    expect(aprovado.status).toBe('APROVADO');
    expect(await service.consultarOrcamento('os-1')).toEqual(aprovado);
  });

  it('rejects a second decision after the quote was refused', async () => {
    await service.gerarOrcamento('os-2', 40);
    await service.reprovarOrcamento('os-2');

    await expect(service.aprovarOrcamento('os-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('opens a payment and confirms it', async () => {
    const aberto = await service.abrirPagamento('os-1', 80);
    const deNovo = await service.abrirPagamento('os-1', 80);

    expect(aberto.status).toBe('PENDENTE');
    expect(deNovo).toBe(aberto);

    const confirmado = await service.confirmarPagamento('os-1');
    expect(confirmado.status).toBe('APROVADO');
  });

  it('does not confirm a refused payment', async () => {
    await service.abrirPagamento('os-3', 10);
    await service.recusarPagamento('os-3');

    await expect(service.confirmarPagamento('os-3')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.consultarPagamento('os-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.consultarOrcamento('os-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
