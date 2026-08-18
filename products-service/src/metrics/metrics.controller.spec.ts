import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../auth/auth.module';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { MetricsController } from './metrics.controller';
import { MetricsModule } from './metrics.module';

describe('MetricsController', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'metrics-controller-test-secret';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        MetricsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('marks only the metrics handler as public', () => {
    const handler = Object.getOwnPropertyDescriptor(
      MetricsController.prototype,
      'getMetrics',
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, MetricsController),
    ).toBeUndefined();
  });

  it('exposes Prometheus metrics without a token and excludes its own scrape', async () => {
    const response = await request(app.getHttpServer())
      .get('/metrics?param=value')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# HELP http_requests_total');
    expect(response.text).toContain('# HELP http_request_duration_seconds');
    expect(response.text).toContain('# HELP process_cpu_user_seconds_total');
    expect(response.text).not.toContain('route="/metrics"');
  });

  afterAll(async () => app.close());
});
