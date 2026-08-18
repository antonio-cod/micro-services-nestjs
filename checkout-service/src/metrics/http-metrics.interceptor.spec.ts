import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('HttpMetricsInterceptor', () => {
  const recordHttpRequest = jest.fn();
  const metricsService = { recordHttpRequest } as unknown as MetricsService;
  const interceptor = new HttpMetricsInterceptor(metricsService);

  const createContext = (
    request: Record<string, unknown>,
    statusCode = 200,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method: 'get', baseUrl: '', ...request }),
        getResponse: () => ({ statusCode }),
      }),
    }) as ExecutionContext;

  const handler = (observable = of('ok')): CallHandler => ({
    handle: () => observable,
  });

  beforeEach(() => recordHttpRequest.mockClear());

  it('records success once using an uppercase method and route template', async () => {
    const context = createContext({
      originalUrl: '/orders/123?details=true',
      route: { path: '/orders/:id' },
    });

    await lastValueFrom(interceptor.intercept(context, handler()));

    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(recordHttpRequest).toHaveBeenCalledWith(
      { method: 'GET', route: '/orders/:id', status_code: '200' },
      expect.any(Number),
    );
  });

  it('combines an Express base URL with a relative route path', async () => {
    const context = createContext({
      originalUrl: '/cart/items/123',
      baseUrl: '/cart',
      route: { path: '/items/:itemId' },
    });

    await lastValueFrom(interceptor.intercept(context, handler()));

    expect(recordHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/cart/items/:itemId' }),
      expect.any(Number),
    );
  });

  it('uses the HttpException status, records once and preserves the error', async () => {
    const error = new HttpException('not found', HttpStatus.NOT_FOUND);
    const context = createContext({
      originalUrl: '/orders/missing',
      route: { path: '/orders/:id' },
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(context, handler(throwError(() => error))),
      ),
    ).rejects.toBe(error);
    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(recordHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '404' }),
      expect.any(Number),
    );
  });

  it('uses status 500 for an unexpected error', async () => {
    const error = new Error('failure');
    const context = createContext({
      originalUrl: '/orders',
      route: { path: '/orders' },
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(context, handler(throwError(() => error))),
      ),
    ).rejects.toBe(error);
    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(recordHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '500' }),
      expect.any(Number),
    );
  });

  it('uses unknown when Express has no resolved route template', async () => {
    const context = createContext({ originalUrl: '/not-found/123?x=1' }, 404);

    await lastValueFrom(interceptor.intercept(context, handler()));

    expect(recordHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'unknown', status_code: '404' }),
      expect.any(Number),
    );
  });

  it.each(['/metrics', '/metrics?param=value'])(
    'does not measure its own scrape at %s',
    async (originalUrl) => {
      const context = createContext({
        originalUrl,
        route: { path: '/metrics' },
      });

      await lastValueFrom(interceptor.intercept(context, handler()));

      expect(recordHttpRequest).not.toHaveBeenCalled();
    },
  );
});
