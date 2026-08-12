import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { CacheFallbackService } from '../../common/fallback/cache.fallback';
import { DefaultFallbackService } from '../../common/fallback/default.fallback';
import { TimeoutService } from '../../common/timeout/timeout.service';
import { RetryService } from '../../common/retry/retry.service';
import { serviceConfig } from '../../config/gateway.config';

interface UserInfo {
  userId: string;
  email: string;
  role: string;
}

export interface ProxyResponse<T = unknown> {
  data: T;
  status: number;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly cacheFallbackService: CacheFallbackService,
    private readonly defaultFallbackService: DefaultFallbackService,
    private readonly timeoutService: TimeoutService,
    private readonly retryService: RetryService,
  ) {}

  async proxyRequest(
    serviceName: keyof typeof serviceConfig,
    method: string,
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
    userInfo?: UserInfo,
  ): Promise<ProxyResponse> {
    const service = serviceConfig[serviceName];
    const url = `${service.url}${path}`;

    this.logger.log(`Proxying ${method} request to ${serviceName}: ${url}`);

    const fallback = this.createServiceFallback(serviceName, method, path);

    try {
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        async () => {
          return await this.retryService.executeWithExponentialBackoff(
            async () => {
              return await this.timeoutService.executeWithCustomTimeout(
                async () => {
                  const enhancedHeaders: Record<string, string> = {
                    ...headers,
                  };

                  if (userInfo) {
                    enhancedHeaders['x-user-id'] = userInfo.userId;
                    enhancedHeaders['x-user-email'] = userInfo.email;
                    enhancedHeaders['x-user-role'] = userInfo.role;
                  }

                  const response = await firstValueFrom(
                    this.httpService.request({
                      method: method.toLowerCase(),
                      url,
                      data,
                      headers: enhancedHeaders,
                      timeout: service.timeout,
                      validateStatus: (status) => status < 500,
                    }),
                  );

                  if (method.toLowerCase() === 'get') {
                    this.cacheFallbackService.setCachedData(
                      `${serviceName}-${path}`,
                      response.data as unknown,
                    );
                  }

                  return {
                    data: response.data as unknown,
                    status: response.status,
                  };
                },
                service.timeout,
              );
            },
            4,
          );
        },
        `proxy-${serviceName}`,
        { failureThreshold: 3, timeout: 30000, resetTimeout: 30000 },
        fallback,
      );
    } catch {
      throw new ServiceUnavailableException(
        `${serviceName} service unavailable`,
      );
    }
  }

  private createServiceFallback(
    serviceName: string,
    method: string,
    path: string,
  ): () => Promise<ProxyResponse> {
    switch (serviceName) {
      case 'users':
        if (path.includes('/auth/login')) {
          return this.defaultFallbackService.createErrorFallback(
            'users',
            'Authentication service unavailable',
          );
        }

        return this.defaultFallbackService.createErrorFallback(
          'users',
          'User service unavailable',
        );
      case 'products':
        if (method.toLowerCase() === 'get') {
          return this.cacheFallbackService.createCacheFallback(
            `products-${path}`,
            {
              data: { products: [], total: 0, page: 1, limit: 10 },
              status: 200,
            },
          );
        }

        return this.defaultFallbackService.createErrorFallback(
          'products',
          'Product service unavailable',
        );
      case 'checkout':
      case 'payments':
        return this.defaultFallbackService.createErrorFallback(
          serviceName,
          `${serviceName} service unavailable`,
        );
      default:
        return this.defaultFallbackService.createErrorFallback(
          serviceName,
          'Service unavailable',
        );
    }
  }
}
