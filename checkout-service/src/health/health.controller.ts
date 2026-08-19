import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import {
  HEALTH_RABBITMQ_OPTIONS,
  type HealthRabbitMqOptions,
} from './health.constants';

const healthyResponse = {
  status: 'ok',
  info: {
    database: { status: 'up' },
    rabbitmq: { status: 'up' },
  },
  error: {},
  details: {
    database: { status: 'up' },
    rabbitmq: { status: 'up' },
  },
};

const unavailableResponse = {
  status: 'error',
  info: { database: { status: 'up' } },
  error: { rabbitmq: { status: 'down' } },
  details: {
    database: { status: 'up' },
    rabbitmq: { status: 'down' },
  },
};

@ApiTags('Health')
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
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Verifica a disponibilidade do serviço' })
  @ApiOkResponse({
    description: 'PostgreSQL e RabbitMQ estão disponíveis',
    schema: { example: healthyResponse },
  })
  @ApiServiceUnavailableResponse({
    description: 'Uma ou mais dependências estão indisponíveis',
    schema: { example: unavailableResponse },
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.microservice.pingCheck('rabbitmq', this.rabbitMqOptions),
    ]);
  }
}
