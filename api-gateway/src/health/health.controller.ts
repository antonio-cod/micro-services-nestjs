import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { HealthCheckService as LegacyHealthCheckService } from '../common/health/health-check.service';
import { serviceConfig } from '../config/gateway.config';
import { HealthService } from './health.service';

const DOWNSTREAMS = [
  ['users-service', serviceConfig.users.url],
  ['products-service', serviceConfig.products.url],
  ['checkout-service', serviceConfig.checkout.url],
  ['payments-service', serviceConfig.payments.url],
] as const;

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'error', 'shutting_down'] },
    info: { type: 'object', additionalProperties: true },
    error: { type: 'object', additionalProperties: true },
    details: { type: 'object', additionalProperties: true },
  },
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly legacyHealthCheckService: LegacyHealthCheckService,
    private readonly healthCheckService: HealthCheckService,
    private readonly httpHealthIndicator: HttpHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check do gateway' })
  @ApiResponse({
    status: 200,
    description: 'Todos os serviços downstream estão disponíveis',
    schema: healthResponseSchema,
  })
  @ApiResponse({
    status: 503,
    description: 'Um ou mais serviços downstream estão indisponíveis',
    schema: healthResponseSchema,
  })
  async getHealth(): Promise<HealthCheckResult> {
    return this.healthCheckService.check(
      DOWNSTREAMS.map(
        ([name, baseUrl]) =>
          () =>
            this.httpHealthIndicator.pingCheck(
              name,
              `${baseUrl.replace(/\/+$/, '')}/health`,
              { timeout: 3_000 },
            ),
      ),
    );
  }

  @Get('services')
  @ApiOperation({ summary: 'Health check de todos os serviços' })
  @ApiResponse({ status: 200, description: 'Status de todos os serviços' })
  async getServicesHealth() {
    const services = await this.legacyHealthCheckService.checkAllServices();

    const overallStatus = services.every((s) => s.status === 'healthy')
      ? 'healthy'
      : services.some((s) => s.status === 'healthy')
        ? 'degraded'
        : 'unhealthy';

    return {
      overallStatus,
      timestamp: new Date().toISOString(),
      services,
      summary: {
        total: services.length,
        healthy: services.filter((s) => s.status === 'healthy').length,
        unhealthy: services.filter((s) => s.status === 'unhealthy').length,
        degraded: services.filter((s) => s.status === 'degraded').length,
      },
    };
  }

  @Get('services/:serviceName')
  @ApiOperation({ summary: 'Health check de um serviço específico' })
  @ApiResponse({ status: 200, description: 'Status do serviço' })
  async getServiceHealth(@Param('serviceName') serviceName: string) {
    const cached = this.legacyHealthCheckService.getCachedHealth(serviceName);

    if (!cached) {
      return {
        status: 'unknown',
        message: 'Service not found or never checked',
        timestamp: new Date().toISOString(),
      };
    }

    return cached;
  }

  @Get('ready')
  @ApiOperation({ summary: 'Get readiness status' })
  @ApiResponse({
    status: 200,
    description: 'Readiness status retrieved successfully',
  })
  async getReady() {
    return this.healthService.getReadyStatus();
  }

  @Get('live')
  @ApiOperation({ summary: 'Get liveness status' })
  @ApiResponse({
    status: 200,
    description: 'Liveness status retrieved successfully',
  })
  async getLive() {
    return this.healthService.getLiveStatus();
  }
}
