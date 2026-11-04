import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const password = process.env.POSTGRES_PASSWORD;
        if (!password) {
          throw new Error('POSTGRES_PASSWORD is required');
        }

        return {
          type: 'postgres' as const,
          host: process.env.POSTGRES_HOST ?? 'localhost',
          port: Number.parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
          username: process.env.POSTGRES_USER ?? 'oficina',
          password,
          database: process.env.POSTGRES_DB ?? 'oficina_billing',
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
