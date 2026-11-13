import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export class ValorDaOsRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identificador da ordem de serviço',
  })
  osId: string;

  @ApiProperty({
    minimum: 0,
    example: 275.5,
    description: 'Valor calculado pela OS',
  })
  valorTotal: number;
}

export class OrcamentoOpenApiDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  osId: string;

  @ApiProperty({
    type: String,
    example: '275.50',
    description: 'Valor decimal persistido pelo Postgres',
  })
  valorTotal: string;

  @ApiProperty({ enum: ['GERADO', 'APROVADO', 'REPROVADO'] })
  status: 'GERADO' | 'APROVADO' | 'REPROVADO';

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class PagamentoOpenApiDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  osId: string;

  @ApiProperty({
    type: String,
    example: '275.50',
    description: 'Valor decimal persistido pelo Postgres',
  })
  valorTotal: string;

  @ApiProperty({ enum: ['PENDENTE', 'APROVADO', 'RECUSADO'] })
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';

  @ApiProperty({ nullable: true })
  mercadoPagoOrderId: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export function ApiCaixaDataResponse(
  type: Type<unknown>,
  description: string,
  status = 200,
) {
  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: { data: { $ref: getSchemaPath(type) } },
        required: ['data'],
      },
    }),
  );
}
