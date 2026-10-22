import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number.parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
        username: process.env.POSTGRES_USER ?? 'oficina',
        password: process.env.POSTGRES_PASSWORD ?? 'oficina123',
        database: process.env.POSTGRES_DB ?? 'oficina_billing',
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
