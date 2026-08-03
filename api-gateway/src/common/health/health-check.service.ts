import { Injectable, Logger } from '@nestjs/common';

import type { HttpService } from '@nestjs/axios';
import type { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';

import { firstValueFrom, timeout } from 'rxjs';
import { ServiceHealth } from './health-check.interface';
import { serviceConfig } from '../../config/gateway.config';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly healthCache = new Map<string, ServiceHealth>();

  constructor(
    private readonly httpService: HttpService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async checkServiceHealth(
    serviceName: keyof typeof serviceConfig,
  ): Promise<ServiceHealth> {
    const service = serviceConfig[serviceName];
    const startTime = Date.now();

    try {
      await this.circuitBreakerService.executeWithCircuitBreaker(
        async () => {
          const response = await firstValueFrom(
            this.httpService
              .get(`${service.url}/health`, {
                timeout: service.timeout,
              })
              .pipe(timeout(service.timeout)),
          );

          return response.status;
        },
        `health-${serviceName}`,
        {
          failureThreshold: 5,
          timeout: 60000,
          resetTimeout: 30000,
        },
        async () => {
          throw new Error('Circuit breaker fallback');
        },
      );

      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: serviceName,
        url: service.url,
        status: HealthStatus.HEALTHY,
        responseTime,
        lastCheck: new Date(),
      };

      this.healthCache.set(serviceName, serviceHealth);

      return serviceHealth;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const serviceHealth: ServiceHealth = {
        name: serviceName,
        url: service.url,
        status: HealthStatus.UNHEALTHY,
        responseTime,
        lastCheck: new Date(),
        error: error.message,
      };
      this.healthCache.set(serviceName, serviceHealth);
      this.logger.error(
        `Health check failed for ${serviceName}`,
        error.message,
      );

      return serviceHealth;
    }
  }
}
