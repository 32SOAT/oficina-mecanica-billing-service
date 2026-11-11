import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaixaModule } from '../caixa/caixa.module';
import { SagaCommandEntity } from './saga-command.entity';
import { SagaCommandConsumer } from './sqs/saga-command-consumer';
import { SqsClientModule } from './sqs/sqs-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SagaCommandEntity]),
    CaixaModule,
    SqsClientModule,
  ],
  providers: [SagaCommandConsumer],
})
export class SagaModule {}
