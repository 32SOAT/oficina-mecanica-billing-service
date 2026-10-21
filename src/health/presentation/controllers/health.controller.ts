import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckHealthUseCase } from '../../application/use-cases/check-health.use-case';
import { HealthResponseDto } from '../dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Verifica se o serviço está online',
  })
  @ApiResponse({
    status: 200,
    description: 'Serviço online.',
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    return HealthResponseDto.fromReadModel(this.checkHealthUseCase.execute());
  }
}
