import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthCheckResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './health.module';

describe('Health endpoint', () => {
  let app: INestApplication<App>;
  const databasePing = jest.fn();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: databasePing })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  beforeEach(() => {
    databasePing.mockReset();
    databasePing.mockResolvedValue({ database: { status: 'up' } });
  });

  afterAll(async () => app.close());

  it('returns 200 when PostgreSQL is available', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Cache-Control', 'no-cache, no-store, must-revalidate');

    expect(response.body).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });

  it('returns a sanitized 503 when PostgreSQL is unavailable', async () => {
    databasePing.mockResolvedValue({ database: { status: 'down' } });

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    const body = response.body as HealthCheckResult;
    const serializedBody = JSON.stringify(body);

    expect(body.status).toBe('error');
    expect(body.error?.database).toEqual({ status: 'down' });
    expect(body.details).toEqual({ database: { status: 'down' } });
    expect(serializedBody).not.toMatch(/DB_(HOST|PORT|USERNAME|PASSWORD)/);
    expect(serializedBody).not.toContain('postgres://');
    expect(serializedBody).not.toContain('password');
    expect(serializedBody).not.toContain('driver');
    expect(body).not.toHaveProperty('stack');
  });
});
