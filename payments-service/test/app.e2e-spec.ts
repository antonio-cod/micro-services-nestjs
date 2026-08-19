import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MicroserviceHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PaymentQueueService } from '../src/events/payment-queue/payment-queue.service';
import { PaymentResultPublisherService } from '../src/events/payment-result/payment-result-publisher.service';
import { RabbitmqService } from '../src/events/rabbitmq/rabbitmq.service';
import { PaymentsService } from '../src/payments/payments.service';

jest.mock('../src/config/database.config', () => ({
  databaseConfig: { type: 'better-sqlite3', database: ':memory:', autoLoadEntities: true, synchronize: true, dropSchema: true },
}));

process.env.RABBITMQ_URL = 'amqp://unused:test@localhost:5672';

describe('payments-service HTTP (e2e)', () => {
  let app: INestApplication;
  let payments: PaymentsService;
  const userId = 'f5d9e8c8-54c3-40c5-a8f5-cf84e29efef4';
  const approvedOrderId = '91afac99-0cd9-4438-945e-2766594a725c';
  const rejectedOrderId = '82f9d25c-9749-49fa-8694-b55b20b1059f';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RabbitmqService).useValue({ waitForConnection: jest.fn().mockResolvedValue(false), publishMessage: jest.fn() })
      .overrideProvider(PaymentQueueService).useValue({ consumePaymentOrders: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(PaymentResultPublisherService).useValue({ publish: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(TypeOrmHealthIndicator).useValue({ pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) })
      .overrideProvider(MicroserviceHealthIndicator).useValue({ pingCheck: jest.fn().mockResolvedValue({ rabbitmq: { status: 'up' } }) })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    payments = moduleRef.get(PaymentsService);
    const base = { userId, items: [{ productId: approvedOrderId, quantity: 1, price: 100 }], paymentMethod: 'pix', createdAt: new Date() };
    await payments.processPayment({ ...base, orderId: approvedOrderId, amount: 100 });
    await payments.processPayment({ ...base, orderId: rejectedOrderId, amount: 49.99 });
  });

  it('returns approved and rejected persisted payments through HTTP', async () => {
    await request(app.getHttpServer()).get(`/payments/${approvedOrderId}`).expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ orderId: approvedOrderId, userId, amount: 100, status: 'approved', rejectionReason: null });
        expect(body.transactionId).toEqual(expect.any(String));
      });
    await request(app.getHttpServer()).get(`/payments/${rejectedOrderId}`).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ orderId: rejectedOrderId, amount: 49.99, status: 'rejected', transactionId: null, rejectionReason: 'Cartão recusado pela operadora' }));
  });

  it('validates order IDs and missing payments', async () => {
    await request(app.getHttpServer()).get('/payments/not-a-uuid').expect(400);
    await request(app.getHttpServer()).get('/payments/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('exposes health without contacting PostgreSQL or RabbitMQ', async () => {
    await request(app.getHttpServer()).get('/health').expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok', details: { database: { status: 'up' }, rabbitmq: { status: 'up' } } }));
  });

  afterAll(() => app.close());
});
