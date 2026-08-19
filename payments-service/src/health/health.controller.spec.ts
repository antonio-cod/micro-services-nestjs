import { Transport } from '@nestjs/microservices';
import {
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const rabbitMqOptions = {
    transport: Transport.RMQ,
    options: { urls: ['amqp://user:password@rabbitmq:5672'] },
  } as const;
  const healthyResult = {
    status: 'ok' as const,
    info: {
      database: { status: 'up' as const },
      rabbitmq: { status: 'up' as const },
    },
    error: {},
    details: {
      database: { status: 'up' as const },
      rabbitmq: { status: 'up' as const },
    },
  };

  it('checks PostgreSQL and RabbitMQ with stable names and options', async () => {
    const database = { pingCheck: jest.fn() };
    const microservice = { pingCheck: jest.fn() };
    const health = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
        return healthyResult;
      }),
    };
    database.pingCheck.mockResolvedValue({ database: { status: 'up' } });
    microservice.pingCheck.mockResolvedValue({ rabbitmq: { status: 'up' } });
    const controller = new HealthController(
      health as unknown as HealthCheckService,
      database as unknown as TypeOrmHealthIndicator,
      microservice as unknown as MicroserviceHealthIndicator,
      rabbitMqOptions,
    );

    await expect(controller.check()).resolves.toEqual(healthyResult);
    expect(health.check).toHaveBeenCalledTimes(1);
    expect(database.pingCheck).toHaveBeenCalledTimes(1);
    expect(database.pingCheck).toHaveBeenCalledWith('database');
    expect(microservice.pingCheck).toHaveBeenCalledTimes(1);
    expect(microservice.pingCheck).toHaveBeenCalledWith(
      'rabbitmq',
      rabbitMqOptions,
    );
    expect(rabbitMqOptions).toEqual({
      transport: Transport.RMQ,
      options: { urls: ['amqp://user:password@rabbitmq:5672'] },
    });
  });

  it('propagates a Terminus failure', async () => {
    const failure = new Error('health check failed');
    const health = { check: jest.fn().mockRejectedValue(failure) };
    const controller = new HealthController(
      health as unknown as HealthCheckService,
      { pingCheck: jest.fn() } as unknown as TypeOrmHealthIndicator,
      { pingCheck: jest.fn() } as unknown as MicroserviceHealthIndicator,
      rabbitMqOptions,
    );

    await expect(controller.check()).rejects.toBe(failure);
  });
});
