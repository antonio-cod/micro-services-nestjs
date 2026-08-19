import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.mock('./../src/config/database.config', () => ({
  databaseConfig: { type: 'better-sqlite3', database: ':memory:', autoLoadEntities: true, synchronize: true, dropSchema: true },
}));

process.env.JWT_SECRET = 'products-e2e-secret';

describe('products-service HTTP (e2e)', () => {
  let app: INestApplication;
  const sellerId = '91afac99-0cd9-4438-945e-2766594a725c';
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const sellerToken = jwt.sign({ sub: sellerId, email: 'seller@test.dev', role: 'seller' });
  const buyerToken = jwt.sign({ sub: 'f5d9e8c8-54c3-40c5-a8f5-cf84e29efef4', email: 'buyer@test.dev', role: 'buyer' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  it('creates, lists and retrieves a product through HTTP', async () => {
    const created = await request(app.getHttpServer()).post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Keyboard', description: 'Mechanical keyboard', price: 249.9, stock: 4 }).expect(201);
    expect(created.body).toMatchObject({ name: 'Keyboard', sellerId, isActive: true, stock: 4 });
    expect(Number(created.body.price)).toBe(249.9);
    await request(app.getHttpServer()).get('/products').expect(200)
      .expect(({ body }) => expect(body).toEqual([expect.objectContaining({ id: created.body.id })]));
    await request(app.getHttpServer()).get(`/products/${created.body.id}`).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: created.body.id, name: 'Keyboard' }));
    await request(app.getHttpServer()).get(`/products/seller/${sellerId}`).expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
  });

  it('enforces authentication, role and request validation', async () => {
    const input = { name: 'Mouse', description: 'Wireless mouse', price: 99, stock: 2 };
    await request(app.getHttpServer()).post('/products').send(input).expect(401);
    await request(app.getHttpServer()).post('/products').set('Authorization', `Bearer ${buyerToken}`).send(input).expect(403);
    await request(app.getHttpServer()).post('/products').set('Authorization', `Bearer ${sellerToken}`).send({ ...input, price: -1, extra: true }).expect(400);
    await request(app.getHttpServer()).get('/products/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('exposes a public health check backed by SQLite', async () => {
    await request(app.getHttpServer()).get('/health').expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok', details: { database: { status: 'up' } } }));
  });

  afterAll(() => app.close());
});
