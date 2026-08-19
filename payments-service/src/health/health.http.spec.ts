import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  HealthCheckResult,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './health.module';

describe('Health endpoint', () => {
  let app: INestApplication<App>;
  const databasePing = jest.fn();
  const rabbitmqPing = jest.fn();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ RABBITMQ_URL: 'amqp://rabbitmq:5672' })],
        }),
        HealthModule,
      ],
    })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: databasePing })
      .overrideProvider(MicroserviceHealthIndicator)
      .useValue({ pingCheck: rabbitmqPing })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    databasePing.mockReset();
    rabbitmqPing.mockReset();
    databasePing.mockResolvedValue({ database: { status: 'up' } });
    rabbitmqPing.mockResolvedValue({ rabbitmq: { status: 'up' } });
  });

  afterAll(async () => app.close());

  it('returns 200 when both dependencies are available', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
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
    });
  });

  it('returns 503 and identifies an unavailable database', async () => {
    databasePing.mockResolvedValue({ database: { status: 'down' } });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    const body = response.body as HealthCheckResult;

    expect(body.status).toBe('error');
    expect(body.error?.database).toEqual({ status: 'down' });
    expect(body.details.database).toEqual({ status: 'down' });
    expect(body.details.rabbitmq).toEqual({ status: 'up' });
    expect(JSON.stringify(body)).not.toContain('RABBITMQ_URL');
    expect(JSON.stringify(body)).not.toContain('amqp://');
    expect(body).not.toHaveProperty('stack');
  });

  it('returns 503 and identifies an unavailable RabbitMQ broker', async () => {
    rabbitmqPing.mockResolvedValue({ rabbitmq: { status: 'down' } });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    const body = response.body as HealthCheckResult;

    expect(body.status).toBe('error');
    expect(body.error?.rabbitmq).toEqual({ status: 'down' });
    expect(body.details.database).toEqual({ status: 'up' });
    expect(body.details.rabbitmq).toEqual({ status: 'down' });
    expect(JSON.stringify(body)).not.toContain('RABBITMQ_URL');
    expect(JSON.stringify(body)).not.toContain('amqp://');
    expect(body).not.toHaveProperty('stack');
  });
});
