import * as Joi from 'joi';

export const SAGA_SCHEMA_VERSION = 1 as const;

export const SagaCommandType = {
  ExecutionOpen: 'EXECUTION_OPEN',
  ExecutionComplete: 'EXECUTION_COMPLETE',
  BillingQuoteGenerate: 'BILLING_QUOTE_GENERATE',
  BillingQuoteApprove: 'BILLING_QUOTE_APPROVE',
  BillingQuoteReject: 'BILLING_QUOTE_REJECT',
  BillingPaymentOpen: 'BILLING_PAYMENT_OPEN',
} as const;

export type SagaCommandType =
  (typeof SagaCommandType)[keyof typeof SagaCommandType];

export const SagaStepStatus = {
  Pendente: 'PENDENTE',
  EmProcessamento: 'EM_PROCESSAMENTO',
  Concluida: 'CONCLUIDA',
  Falha: 'FALHA',
} as const;

export type SagaStepStatus =
  (typeof SagaStepStatus)[keyof typeof SagaStepStatus];

export type EtapaExecucao = 'DIAGNOSTICO' | 'REPARO';

export type SagaCommandPayloads = {
  [SagaCommandType.ExecutionOpen]: { etapa: EtapaExecucao };
  [SagaCommandType.ExecutionComplete]: { etapa: EtapaExecucao };
  [SagaCommandType.BillingQuoteGenerate]: { valorTotal: number };
  [SagaCommandType.BillingQuoteApprove]: Record<string, never>;
  [SagaCommandType.BillingQuoteReject]: Record<string, never>;
  [SagaCommandType.BillingPaymentOpen]: { valorTotal: number };
};

export type SagaEnvelope = {
  messageId: string;
  commandId: string;
  sagaId: string;
  osId: string;
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
  schemaVersion: typeof SAGA_SCHEMA_VERSION;
};

export type SagaCommandMessage = {
  [T in SagaCommandType]: SagaEnvelope & {
    type: T;
    payload: SagaCommandPayloads[T];
  };
}[SagaCommandType];

export type SagaResultMessage =
  | (SagaEnvelope & {
      type: 'SAGA_STEP_RESULT';
      outcome: typeof SagaStepStatus.Concluida;
      payload: Record<string, never>;
    })
  | (SagaEnvelope & {
      type: 'SAGA_STEP_RESULT';
      outcome: typeof SagaStepStatus.Falha;
      payload: { code: string; message: string; retryable: boolean };
    });

const envelopeSchema = {
  messageId: Joi.string().uuid().required(),
  commandId: Joi.string().uuid().required(),
  sagaId: Joi.string().uuid().required(),
  osId: Joi.string().uuid().required(),
  occurredAt: Joi.string().isoDate().required(),
  correlationId: Joi.string().min(1).required(),
  causationId: Joi.string().allow(null).required(),
  schemaVersion: Joi.number().valid(SAGA_SCHEMA_VERSION).required(),
};

const emptyPayloadSchema = Joi.object({}).unknown(false);
const executionPayloadSchema = Joi.object({
  etapa: Joi.string().valid('DIAGNOSTICO', 'REPARO').required(),
}).unknown(false);
const amountPayloadSchema = Joi.object({
  valorTotal: Joi.number().min(0).precision(2).required(),
}).unknown(false);

const commandVariants: Array<[SagaCommandType, Joi.Schema]> = [
  [SagaCommandType.ExecutionOpen, executionPayloadSchema],
  [SagaCommandType.ExecutionComplete, executionPayloadSchema],
  [SagaCommandType.BillingQuoteGenerate, amountPayloadSchema],
  [SagaCommandType.BillingQuoteApprove, emptyPayloadSchema],
  [SagaCommandType.BillingQuoteReject, emptyPayloadSchema],
  [SagaCommandType.BillingPaymentOpen, amountPayloadSchema],
];

export const sagaCommandMessageSchema = Joi.alternatives().try(
  ...commandVariants.map(([type, payload]) =>
    Joi.object({
      ...envelopeSchema,
      type: Joi.string().valid(type).required(),
      payload: payload.required(),
    }).unknown(false),
  ),
);

export const sagaResultMessageSchema = Joi.object({
  ...envelopeSchema,
  type: Joi.string().valid('SAGA_STEP_RESULT').required(),
  outcome: Joi.string()
    .valid(SagaStepStatus.Concluida, SagaStepStatus.Falha)
    .required(),
  payload: Joi.alternatives()
    .conditional('outcome', {
      is: SagaStepStatus.Concluida,
      then: emptyPayloadSchema,
      otherwise: Joi.object({
        code: Joi.string().min(1).required(),
        message: Joi.string().min(1).required(),
        retryable: Joi.boolean().required(),
      }).unknown(false),
    })
    .required(),
}).unknown(false);

export function isSagaCommandMessage(
  value: unknown,
): value is SagaCommandMessage {
  return !sagaCommandMessageSchema.validate(value, {
    abortEarly: false,
    convert: false,
  }).error;
}

export function isSagaResultMessage(
  value: unknown,
): value is SagaResultMessage {
  return !sagaResultMessageSchema.validate(value, {
    abortEarly: false,
    convert: false,
  }).error;
}
