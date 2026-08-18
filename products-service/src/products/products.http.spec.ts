import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../auth/auth.module';
import { MetricsModule } from '../metrics/metrics.module';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const jwtSecret = 'products-create-http-test-secret';

describe('Products endpoints (HTTP)', () => {
  let app: INestApplication<App>;
  let create: jest.Mock<Promise<Product>, [CreateProductDto, string]>;
  let findAll: jest.Mock<Promise<Product[]>, []>;
  let findBySeller: jest.Mock<Promise<Product[]>, [string]>;
  let findOne: jest.Mock<Promise<Product>, [string]>;
  const jwtService = new JwtService();
  const sellerId = '91afac99-0cd9-4438-945e-2766594a725c';
  const validBody = {
    name: 'Notebook',
    description: 'Notebook para desenvolvimento',
    price: 5499.9,
    stock: 3,
  };

  function tokenFor(role: string, secret = jwtSecret): string {
    return jwtService.sign(
      { sub: sellerId, email: `${role}@example.com`, role },
      { secret, expiresIn: 60 },
    );
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    create = jest.fn<Promise<Product>, [CreateProductDto, string]>();
    findAll = jest.fn<Promise<Product[]>, []>();
    findBySeller = jest.fn<Promise<Product[]>, [string]>();
    findOne = jest.fn<Promise<Product>, [string]>();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        MetricsModule,
      ],
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: { create, findAll, findBySeller, findOne },
        },
      ],
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

  beforeEach(() => {
    create.mockReset();
    findAll.mockReset();
    findBySeller.mockReset();
    findOne.mockReset();
    create.mockImplementation((body, authenticatedSellerId) =>
      Promise.resolve({
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        ...body,
        price: String(body.price),
        sellerId: authenticatedSellerId,
        isActive: true,
        createdAt: new Date('2026-08-13T12:00:00.000Z'),
        updatedAt: new Date('2026-08-13T12:00:00.000Z'),
      } as Product),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a product for an authenticated seller', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${tokenFor('seller')}`)
      .send(validBody)
      .expect(201);

    expect(response.body).toMatchObject({
      ...validBody,
      price: '5499.9',
      sellerId,
      isActive: true,
    });
    expect(create).toHaveBeenCalledWith(validBody, sellerId);
  });

  it.each(['buyer', 'admin'])(
    'returns 403 for role %s without persisting',
    async (role) => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${tokenFor(role)}`)
        .send(validBody)
        .expect(403);

      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined],
    ['malformed token', 'Bearer malformed.token'],
    ['invalid signature', `Bearer ${tokenFor('seller', 'wrong-secret')}`],
  ])('returns 401 for %s without persisting', async (_case, authorization) => {
    const pendingRequest = request(app.getHttpServer())
      .post('/products')
      .send(validBody);

    if (authorization) {
      pendingRequest.set('Authorization', authorization);
    }

    await pendingRequest.expect(401);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing name', { ...validBody, name: undefined }, 'name'],
    ['empty description', { ...validBody, description: '' }, 'description'],
    ['price below minimum', { ...validBody, price: 0 }, 'price'],
    ['price with three decimals', { ...validBody, price: 1.001 }, 'price'],
    ['fractional stock', { ...validBody, stock: 1.5 }, 'stock'],
    ['negative stock', { ...validBody, stock: -1 }, 'stock'],
    ['sellerId', { ...validBody, sellerId: 'another-user' }, 'sellerId'],
    ['isActive', { ...validBody, isActive: false }, 'isActive'],
    ['unknown field', { ...validBody, category: 'computers' }, 'category'],
  ])('returns 400 for %s without persisting', async (_case, body, field) => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${tokenFor('seller')}`)
      .send(body)
      .expect(400);

    const responseBody = response.body as { message: string[] };
    expect(responseBody.message.join(' ')).toContain(field);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the public active product catalog without a token', async () => {
    const products = [
      {
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        name: 'Produto recente',
        isActive: true,
        createdAt: new Date('2026-08-13T13:00:00.000Z'),
      },
      {
        id: 'c04045f0-04f3-4a22-91cc-76ff61341a47',
        name: 'Produto antigo',
        isActive: true,
        createdAt: new Date('2026-08-13T12:00:00.000Z'),
      },
    ] as Product[];
    findAll.mockResolvedValue(products);

    const response = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    const responseBody = response.body as Product[];

    expect(responseBody).toHaveLength(2);
    expect(responseBody.map((product) => product.id)).toEqual([
      products[0].id,
      products[1].id,
    ]);
    expect(findAll).toHaveBeenCalledWith();
  });

  it('returns an empty public product catalog', async () => {
    findAll.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('returns public active products for a seller using the prefixed route', async () => {
    const products = [
      {
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        sellerId,
        isActive: true,
      },
    ] as Product[];
    findBySeller.mockResolvedValue(products);

    const response = await request(app.getHttpServer())
      .get(`/products/seller/${sellerId}`)
      .expect(200);

    expect(response.body).toEqual(products);
    expect(findBySeller).toHaveBeenCalledWith(sellerId);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns an empty public seller product list without 404', async () => {
    findBySeller.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get(`/products/seller/${sellerId}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it.each([true, false])(
    'returns a public product by id when isActive is %s',
    async (isActive) => {
      const product = {
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        name: 'Produto',
        isActive,
      } as Product;
      findOne.mockResolvedValue(product);

      const response = await request(app.getHttpServer())
        .get(`/products/${product.id}`)
        .expect(200);

      expect(response.body).toEqual(product);
      expect(findOne).toHaveBeenCalledWith(product.id);
    },
  );

  it('returns 404 when the requested product does not exist', async () => {
    const productId = '1381eeaf-0171-44e3-b03a-86359448b2b9';
    findOne.mockRejectedValue(new NotFoundException('Produto não encontrado'));

    const response = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(404);
    const responseBody = response.body as { message: string };

    expect(responseBody.message).toBe('Produto não encontrado');
  });

  it('keeps POST /products protected when no token is provided', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send(validBody)
      .expect(401);

    expect(create).not.toHaveBeenCalled();
  });

  it('exports a parameterized product route without concrete IDs or self-scrapes', async () => {
    const productId = '5ac9aa73-b746-4d95-a888-fd3d63ea9d9f';
    findOne.mockResolvedValue({ id: productId } as Product);

    await request(app.getHttpServer())
      .get(`/products/${productId}?source=metrics-test`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/metrics?source=prometheus')
      .expect(200);

    expect(response.text).toContain(
      'http_requests_total{method="GET",route="/products/:id",status_code="200"}',
    );
    expect(response.text).not.toContain(productId);
    expect(response.text).not.toContain('source=metrics-test');
    expect(response.text).not.toContain('route="/metrics"');
  });
});
