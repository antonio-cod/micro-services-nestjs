import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { CacheFallbackService } from '../../common/fallback/cache.fallback';
import { DefaultFallbackService } from '../../common/fallback/default.fallback';
import { RetryService } from '../../common/retry/retry.service';
import { TimeoutService } from '../../common/timeout/timeout.service';
import { serviceConfig } from '../../config/gateway.config';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let httpService: { request: jest.Mock };
  let cache: { setCachedData: jest.Mock };
  let service: ProxyService;

  beforeEach(() => {
    httpService = { request: jest.fn() };
    cache = { setCachedData: jest.fn() };
    const circuitBreaker = {
      executeWithCircuitBreaker: jest.fn((operation: () => Promise<unknown>) =>
        operation(),
      ),
    };
    const retry = {
      executeWithExponentialBackoff: jest.fn(
        (operation: () => Promise<unknown>) => operation(),
      ),
    };
    const timeout = {
      executeWithCustomTimeout: jest.fn((operation: () => Promise<unknown>) =>
        operation(),
      ),
    };
    const fallback = {
      createErrorFallback: jest.fn(() => async () => {
        throw new Error('unavailable');
      }),
      createCacheFallback: jest.fn(),
    };

    service = new ProxyService(
      httpService as unknown as HttpService,
      circuitBreaker as unknown as CircuitBreakerService,
      cache as unknown as CacheFallbackService,
      fallback as unknown as DefaultFallbackService,
      timeout as unknown as TimeoutService,
      retry as unknown as RetryService,
    );
  });

  it('forwards method, path, body, authorization and user claims', async () => {
    const upstream = { data: { id: 'user-id' }, status: 200 } as AxiosResponse;
    httpService.request.mockReturnValue(of(upstream));

    await expect(
      service.proxyRequest(
        'users',
        'GET',
        '/users/profile?include=role',
        undefined,
        { Authorization: 'Bearer signed.jwt' },
        { userId: 'user-id', email: 'buyer@example.com', role: 'buyer' },
      ),
    ).resolves.toEqual({ data: upstream.data, status: 200 });

    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: `${serviceConfig.users.url}/users/profile?include=role`,
        headers: {
          Authorization: 'Bearer signed.jwt',
          'x-user-id': 'user-id',
          'x-user-email': 'buyer@example.com',
          'x-user-role': 'buyer',
        },
      }),
    );
  });

  it('preserves functional 4xx responses', async () => {
    httpService.request.mockReturnValue(
      of({ data: { message: 'Email já cadastrado' }, status: 409 }),
    );

    await expect(
      service.proxyRequest('users', 'POST', '/auth/register', {}),
    ).resolves.toEqual({
      data: { message: 'Email já cadastrado' },
      status: 409,
    });
  });

  it('maps communication failures to service unavailable', async () => {
    httpService.request.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );

    await expect(
      service.proxyRequest('users', 'GET', '/users/profile'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
