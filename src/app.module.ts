import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { CoreModule } from './common/core/core.module';
import { HealthModule } from './health/module';

@Module({
  imports: [ConfigModule, CoreModule, HealthModule],
})
export class AppModule {}
