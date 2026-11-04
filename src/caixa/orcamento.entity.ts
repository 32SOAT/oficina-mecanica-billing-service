import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StatusOrcamento = 'GERADO' | 'APROVADO' | 'REPROVADO';

@Entity('orcamento')
export class OrcamentoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  osId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  valorTotal: number;

  @Column({ default: 'GERADO' })
  status: StatusOrcamento;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
