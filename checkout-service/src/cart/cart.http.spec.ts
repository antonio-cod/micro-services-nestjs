import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { emptyCartResponse } from './cart-response';
import { CartService } from './cart.service';

const jwtSecret = 'cart-http-test-secret';
const userId = '91afac99-0cd9-4438-945e-2766594a725c';
const productId = 'f18d3b2f-fc2d-4867-b62f-708497172963';

describe('CartController (HTTP)', () => {
  let app: INestApplication<App>;
  const jwtService = new JwtService();
  const cartService = {
    addItem: jest.fn(),
    findActive: jest.fn(),
    removeItem: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
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

  function token(role: 'seller' | 'buyer') {
    return jwtService.sign(
      { sub: userId, email: `${role}@example.com`, role },
      { secret: jwtSecret },
    );
  }

  it.each(['seller', 'buyer'] as const)(
    'allows %s to add a valid item using the authenticated id',
    async (role) => {
      cartService.addItem.mockResolvedValue(emptyCartResponse(userId));

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${token(role)}`)
        .send({ productId, quantity: 2 })
        .expect(200);

      expect(cartService.addItem).toHaveBeenCalledWith(userId, {
        productId,
        quantity: 2,
      });
    },
  );

  it.each([
    [{ quantity: 1 }, 'missing product'],
    [{ productId: 'invalid', quantity: 1 }, 'invalid product'],
    [{ productId, quantity: 0 }, 'zero quantity'],
    [{ productId, quantity: 1.5 }, 'fractional quantity'],
    [{ productId, quantity: 1, userId }, 'extra field'],
  ])('rejects invalid payload: %s (%s)', async (payload) => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .send(payload)
      .expect(400);
    expect(cartService.addItem).not.toHaveBeenCalled();
  });

  it('protects all cart endpoints', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
    await request(app.getHttpServer())
      .post('/cart/items')
      .send({ productId, quantity: 1 })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/cart/items/${productId}`)
      .expect(401);
  });

  it('returns an empty cart without accepting a user id from input', async () => {
    cartService.findActive.mockResolvedValue(emptyCartResponse(userId));
    const response = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: null,
      userId,
      status: 'active',
      total: 0,
      items: [],
      createdAt: null,
      updatedAt: null,
    });
    expect(cartService.findActive).toHaveBeenCalledWith(userId);
  });

  it('rejects an invalid item id before invoking the service', async () => {
    await request(app.getHttpServer())
      .delete('/cart/items/not-a-uuid')
      .set('Authorization', `Bearer ${token('buyer')}`)
      .expect(400);
    expect(cartService.removeItem).not.toHaveBeenCalled();
  });
});
