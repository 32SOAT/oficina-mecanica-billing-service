import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../../../config/config.module';
import { HealthReadModel } from '../read-models/health-read-model';

@Injectable()
export class CheckHealthUseCase {
  constructor(
    private readonly configService: ConfigService<ConfigType, true>,
  ) {}

  execute(): HealthReadModel {
    return {
      status: 'ok',
      service: this.configService.get('app.serviceName', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }
}
