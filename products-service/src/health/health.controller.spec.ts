import { HEADERS_METADATA } from '@nestjs/common/constants';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('HealthController', () => {
  const healthyResult = {
    status: 'ok' as const,
    info: { database: { status: 'up' as const } },
    error: {},
    details: { database: { status: 'up' as const } },
  };

  it('delegates a single PostgreSQL check with a stable name', async () => {
    const database = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    const health = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
        return healthyResult;
      }),
    };
    const controller = new HealthController(
      health as unknown as HealthCheckService,
      database as unknown as TypeOrmHealthIndicator,
    );

    await expect(controller.check()).resolves.toEqual(healthyResult);
    expect(health.check).toHaveBeenCalledTimes(1);
    expect(database.pingCheck).toHaveBeenCalledTimes(1);
    expect(database.pingCheck).toHaveBeenCalledWith('database');
  });

  it('propagates a Terminus failure', async () => {
    const failure = new Error('health check failed');
    const health = { check: jest.fn().mockRejectedValue(failure) };
    const controller = new HealthController(
      health as unknown as HealthCheckService,
      { pingCheck: jest.fn() } as unknown as TypeOrmHealthIndicator,
    );

    await expect(controller.check()).rejects.toBe(failure);
  });

  it('is public and disables response caching', () => {
    const handler = Object.getOwnPropertyDescriptor(
      HealthController.prototype,
      'check',
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-cache, no-store, must-revalidate',
    });
  });
});
