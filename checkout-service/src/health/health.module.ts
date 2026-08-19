import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { TerminusModule } from '@nestjs/terminus';
import {
  HEALTH_RABBITMQ_OPTIONS,
  HealthRabbitMqOptions,
} from './health.constants';
import { HealthController } from './health.controller';

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
          urls: [
            configService.get<string>(
              'RABBITMQ_URL',
              'amqp://admin:admin@localhost:5672',
            ),
          ],
        },
      }),
    },
  ],
})
export class HealthModule {}
