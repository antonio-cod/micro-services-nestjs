import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';

const healthyResponse = {
  status: 'ok',
  info: { database: { status: 'up' } },
  error: {},
  details: { database: { status: 'up' } },
};

const unavailableResponse = {
  status: 'error',
  info: {},
  error: { database: { status: 'down' } },
  details: { database: { status: 'down' } },
};

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Verifica a disponibilidade do serviço' })
  @ApiOkResponse({
    description: 'PostgreSQL está disponível',
    schema: { example: healthyResponse },
  })
  @ApiServiceUnavailableResponse({
    description: 'PostgreSQL está indisponível',
    schema: { example: unavailableResponse },
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.pingCheck('database')]);
  }
}
