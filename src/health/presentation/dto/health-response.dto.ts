import { ApiProperty } from '@nestjs/swagger';
import type { HealthReadModel } from '../../application/read-models/health-read-model';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'billing-service' })
  service: string;

  @ApiProperty({
    format: 'date-time',
    example: '2023-10-01T12:00:00.000Z',
  })
  timestamp: string;

  static fromReadModel(readModel: HealthReadModel): HealthResponseDto {
    return Object.assign(new HealthResponseDto(), readModel);
  }
}
