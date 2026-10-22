import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

@Entity('pagamento')
export class PagamentoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  osId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  valorTotal: number;

  @Column({ default: 'PENDENTE' })
  status: StatusPagamento;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
