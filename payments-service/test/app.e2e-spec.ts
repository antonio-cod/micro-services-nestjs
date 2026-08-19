import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { PaymentsController } from './../src/payments/payments.controller';
import { PaymentsService } from './../src/payments/payments.service';
import { MetricsModule } from './../src/metrics/metrics.module';
import { ConsumerMetricsController } from './../src/events/metrics/consumer-metrics.controller';
import { PaymentConsumerService } from './../src/events/payment-consumer/payment-consumer.service';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './../src/health/health.module';
import {
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const payment = {
    id: '82f9d25c-9749-49fa-8694-b55b20b1059f',
    orderId: '91afac99-0cd9-4438-945e-2766594a725c',
    status: 'approved',
  };
  const consumerMetrics = {
    totalProcessed: 1,
    totalSuccess: 1,
    totalFailed: 0,
    totalRetries: 0,
    averageProcessingTime: 10,
    lastProcessedAt: new Date(),
    startedAt: new Date(),
  };
  const databasePing = jest
    .fn()
    .mockResolvedValue({ database: { status: 'up' } });
  const rabbitmqPing = jest
    .fn()
    .mockResolvedValue({ rabbitmq: { status: 'up' } });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ RABBITMQ_URL: 'amqp://rabbitmq:5672' })],
        }),
        MetricsModule,
        HealthModule,
      ],
      controllers: [
        AppController,
        PaymentsController,
        ConsumerMetricsController,
      ],
      providers: [
        AppService,
        {
          provide: PaymentsService,
          useValue: { findByOrderId: jest.fn().mockResolvedValue(payment) },
        },
        {
          provide: PaymentConsumerService,
          useValue: {
            getMetrics: jest.fn(() => ({ ...consumerMetrics })),
            resetMetrics: jest.fn(),
          },
        },
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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
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

  it('/metrics (GET) is public, uses route templates and excludes scrapes', async () => {
    const orderId = payment.orderId;

    await request(app.getHttpServer()).get(`/payments/${orderId}`).expect(200);
    await request(app.getHttpServer()).get('/consumer-metrics').expect(200);
    await request(app.getHttpServer()).get('/metrics?first=true').expect(200);

    const response = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# HELP http_requests_total');
    expect(response.text).toContain('route="/payments/:orderId"');
    expect(response.text).toContain('route="/consumer-metrics"');
    expect(response.text).not.toContain(orderId);
    expect(response.text).not.toContain('route="/metrics"');
    expect(response.text).not.toContain('"totalProcessed"');
  });

  afterEach(async () => {
    await app.close();
  });
});
