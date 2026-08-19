import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { MicroserviceHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PaymentQueueService } from '../src/events/payment-queue/payment-queue.service';
import { RabbitmqService } from '../src/events/rabbitmq/rabbitmq.service';
import { ProductsClientService } from '../src/products-client/products-client.service';

jest.mock('../src/config/database.config', () => ({
  databaseConfig: { type: 'better-sqlite3', database: ':memory:', autoLoadEntities: true, synchronize: true, dropSchema: true },
}));

process.env.JWT_SECRET = 'checkout-e2e-secret';

describe('checkout-service HTTP (e2e)', () => {
  let app: INestApplication;
  const userId = 'f5d9e8c8-54c3-40c5-a8f5-cf84e29efef4';
  const productId = '91afac99-0cd9-4438-945e-2766594a725c';
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: userId, email: 'buyer@test.dev', role: 'buyer' });
  const publishPaymentOrder = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProductsClientService).useValue({ getProduct: jest.fn().mockResolvedValue({ id: productId, name: 'Keyboard', price: 125.5, isActive: true }) })
      .overrideProvider(PaymentQueueService).useValue({ publishPaymentOrder })
      .overrideProvider(RabbitmqService).useValue({ subscribeToQueue: jest.fn().mockResolvedValue(undefined), publishMessage: jest.fn() })
      .overrideProvider(TypeOrmHealthIndicator).useValue({ pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) })
      .overrideProvider(MicroserviceHealthIndicator).useValue({ pingCheck: jest.fn().mockResolvedValue({ rabbitmq: { status: 'up' } }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  it('adds/removes cart items and completes checkout without external services', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const added = await request(app.getHttpServer()).post('/cart/items').set(auth)
      .send({ productId, quantity: 2 }).expect(200);
    expect(added.body).toMatchObject({ userId, total: 251, items: [expect.objectContaining({ productId, quantity: 2, subtotal: 251 })] });
    await request(app.getHttpServer()).get('/cart').set(auth).expect(200)
      .expect(({ body }) => expect(body.items).toHaveLength(1));
    await request(app.getHttpServer()).post('/cart/checkout').set(auth)
      .send({ paymentMethod: 'pix' }).expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ userId, total: 251, status: 'pending', paymentMethod: 'pix' }));
    expect(publishPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId, amount: 251 }));
    await request(app.getHttpServer()).get('/orders').set(auth).expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
    await request(app.getHttpServer()).get('/cart').set(auth).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: null, total: 0, items: [] }));
  });

  it('validates authentication and business rules', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
    await request(app.getHttpServer()).post('/cart/items').set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 0 }).expect(400);
    await request(app.getHttpServer()).post('/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ paymentMethod: 'pix' }).expect(422);
  });

  it('exposes a public health endpoint with mocked RabbitMQ', async () => {
    await request(app.getHttpServer()).get('/health').expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok', details: { database: { status: 'up' }, rabbitmq: { status: 'up' } } }));
  });

  afterAll(() => app.close());
});
