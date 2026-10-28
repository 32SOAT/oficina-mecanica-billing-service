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

  @Column({ name: 'mercado_pago_order_id', type: 'varchar', nullable: true })
  mercadoPagoOrderId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
