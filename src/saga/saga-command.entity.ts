import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { SagaResultMessage } from './saga-message';

@Entity('saga_command')
export class SagaCommandEntity {
  @PrimaryColumn({ type: 'uuid' })
  commandId: string;

  @Column({ type: 'text' })
  requestFingerprint: string;

  @Column({ type: 'jsonb' })
  result: SagaResultMessage;

  @CreateDateColumn()
  createdAt: Date;
}
