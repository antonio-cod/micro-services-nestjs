import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../auth/auth.module';
import { CheckoutController } from './checkout.controller';
import { OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const jwtSecret = 'orders-http-test-secret';
const userId = '91afac99-0cd9-4438-945e-2766594a725c';
const orderId = '04358217-51aa-4c70-b40e-2294db6272ae';
const cartId = '9bf702fe-dbb4-42af-bc42-956681ed1385';

describe('Orders endpoints (HTTP)', () => {
  let app: INestApplication<App>;
  const jwtService = new JwtService();
  const orderResponse = {
    id: orderId,
    userId,
    cartId,
    total: 25.5,
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.PIX,
    createdAt: new Date('2026-08-15T10:05:00.000Z'),
    updatedAt: new Date('2026-08-15T10:05:00.000Z'),
  };
  const ordersService = {
    checkout: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
      controllers: [CheckoutController, OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  function token(role: 'seller' | 'buyer'): string {
    return jwtService.sign(
      { sub: userId, email: `${role}@example.com`, role },
      { secret: jwtSecret },
    );
  }

  it.each(Object.values(PaymentMethod))(
    'accepts checkout with %s',
    async (paymentMethod: PaymentMethod) => {
      ordersService.checkout.mockResolvedValue({
        ...orderResponse,
        paymentMethod,
      });

      await request(app.getHttpServer())
        .post('/cart/checkout')
        .set('Authorization', `Bearer ${token('buyer')}`)
        .send({ paymentMethod })
        .expect(201);

      expect(ordersService.checkout).toHaveBeenCalledWith(userId, {
        paymentMethod,
      });
    },
  );

  it.each([
    {},
    { paymentMethod: 'cash' },
    { paymentMethod: PaymentMethod.PIX, userId },
  ])('rejects invalid checkout payload %p', async (payload) => {
    await request(app.getHttpServer())
      .post('/cart/checkout')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .send(payload)
      .expect(400);
    expect(ordersService.checkout).not.toHaveBeenCalled();
  });

  it.each(['seller', 'buyer'] as const)(
    'lists orders for an authenticated %s',
    async (role) => {
      ordersService.findAll.mockResolvedValue([orderResponse]);

      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${token(role)}`)
        .expect(200)
        .expect(({ body }: { body: unknown[] }) => {
          expect(body).toHaveLength(1);
        });

      expect(ordersService.findAll).toHaveBeenCalledWith(userId);
    },
  );

  it('returns an empty order list', async () => {
    ordersService.findAll.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .expect(200, []);
  });

  it('gets an order detail using the authenticated user', async () => {
    ordersService.findOne.mockResolvedValue(orderResponse);

    await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token('buyer')}`)
      .expect(200);
    expect(ordersService.findOne).toHaveBeenCalledWith(userId, orderId);
  });

  it('rejects an invalid order id before invoking the service', async () => {
    await request(app.getHttpServer())
      .get('/orders/not-a-uuid')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .expect(400);
    expect(ordersService.findOne).not.toHaveBeenCalled();
  });

  it('protects checkout and order endpoints', async () => {
    await request(app.getHttpServer())
      .post('/cart/checkout')
      .send({ paymentMethod: PaymentMethod.PIX })
      .expect(401);
    await request(app.getHttpServer()).get('/orders').expect(401);
    await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(401);
  });
});
