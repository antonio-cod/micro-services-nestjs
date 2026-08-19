import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import {
  HEALTH_RABBITMQ_OPTIONS,
  type HealthRabbitMqOptions,
} from './health.constants';

@Module({
  imports: [ConfigModule, TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_RABBITMQ_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): HealthRabbitMqOptions => ({
        transport: Transport.RMQ,
        options: {
          urls: [configService.getOrThrow<string>('RABBITMQ_URL')],
        },
      }),
    },
  ],
})
export class HealthModule {}
