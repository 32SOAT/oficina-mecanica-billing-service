import { randomUUID } from 'node:crypto';
import { SagaCommandMessage, SagaResultMessage } from './saga-message';

export function sagaCommandFingerprint(command: SagaCommandMessage): string {
  return JSON.stringify({
    sagaId: command.sagaId,
    osId: command.osId,
    type: command.type,
    payload: command.payload,
  });
}

export function createSagaResult(
  command: SagaCommandMessage,
  result:
    | { outcome: 'CONCLUIDA'; payload: Record<string, never> }
    | {
        outcome: 'FALHA';
        payload: { code: string; message: string; retryable: boolean };
      },
): SagaResultMessage {
  return {
    messageId: randomUUID(),
    commandId: command.commandId,
    sagaId: command.sagaId,
    osId: command.osId,
    occurredAt: new Date().toISOString(),
    correlationId: command.correlationId,
    causationId: command.messageId,
    schemaVersion: command.schemaVersion,
    type: 'SAGA_STEP_RESULT',
    ...result,
  };
}
