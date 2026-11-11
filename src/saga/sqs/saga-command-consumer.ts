import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  Message,
} from '@aws-sdk/client-sqs';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaixaService } from '../../caixa/caixa.service';
import { SqsConfig } from './sqs.config';
import { SQS_CLIENT } from './sqs-client.module';
import { Inject } from '@nestjs/common';
import { isSagaCommandMessage, SagaCommandMessage } from '../saga-message';

@Injectable()
export class SagaCommandConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaCommandConsumer.name);
  private running = false;
  private abortController?: AbortController;

  constructor(
    @Inject(SQS_CLIENT) private readonly client: SQSClient,
    private readonly caixa: CaixaService,
    private readonly config: ConfigService<{ sqs: SqsConfig }>,
  ) {}

  onModuleInit(): void {
    const sqs = this.config.getOrThrow('sqs', { infer: true });
    if (!sqs.enabled) return;
    if (!sqs.commandQueueUrl || !sqs.resultsQueueUrl) {
      throw new Error('URLs SQS do Billing são obrigatórias com worker ativo');
    }
    this.running = true;
    this.abortController = new AbortController();
    void this.consume(sqs);
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.abortController?.abort();
    this.client.destroy();
  }

  async processMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message.Body);
    } catch {
      this.logger.warn(
        `Comando SQS inválido; aguardando DLQ. messageId=${message.MessageId ?? 'desconhecido'}`,
      );
      return;
    }
    if (!isSagaCommandMessage(parsed)) {
      this.logger.warn(
        `Envelope SQS inválido; aguardando DLQ. messageId=${message.MessageId ?? 'desconhecido'}`,
      );
      return;
    }

    const command: SagaCommandMessage = parsed;
    const sqs = this.config.getOrThrow('sqs', { infer: true });
    const result = await this.caixa.processSagaCommand(command);
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: sqs.resultsQueueUrl,
        MessageBody: JSON.stringify(result),
        MessageGroupId: command.osId,
        MessageDeduplicationId: command.commandId,
      }),
    );
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: sqs.commandQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  private async consume(sqs: SqsConfig): Promise<void> {
    while (this.running) {
      try {
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: sqs.commandQueueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
          }),
          { abortSignal: this.abortController?.signal },
        );
        for (const message of response.Messages ?? []) {
          try {
            await this.processMessage(message);
          } catch {
            this.logger.warn(
              `Falha ao processar comando SQS; mensagem será repetida. messageId=${message.MessageId ?? 'desconhecido'}`,
            );
          }
        }
      } catch {
        if (!this.running) return;
        this.logger.error('Falha na leitura da fila SQS do Billing');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}
