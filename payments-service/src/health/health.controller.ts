import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import {
  HEALTH_RABBITMQ_OPTIONS,
  type HealthRabbitMqOptions,
} from './health.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly microservice: MicroserviceHealthIndicator,
    @Inject(HEALTH_RABBITMQ_OPTIONS)
    private readonly rabbitMqOptions: HealthRabbitMqOptions,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.microservice.pingCheck('rabbitmq', this.rabbitMqOptions),
    ]);
  }
}
