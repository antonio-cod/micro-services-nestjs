import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const jwtService = new JwtService();
  const jwtSecret = 'checkout-service-e2e-secret';

  beforeEach(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) is protected by default', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/health (GET) is public', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      service: 'checkout-service',
    });
  });

  it('/metrics (GET) is public and uses low-cardinality route templates', async () => {
    const orderId = '91afac99-0cd9-4438-945e-2766594a725c';
    const token = jwtService.sign(
      {
        sub: 'f5d9e8c8-54c3-40c5-a8f5-cf84e29efef4',
        email: 'buyer@example.com',
        role: 'buyer',
      },
      { secret: jwtSecret, expiresIn: 60 },
    );

    await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('route="/orders/:id"');
    expect(response.text).not.toContain(orderId);
    expect(response.text).not.toContain('route="/metrics"');
  });

  afterEach(async () => {
    await app.close();
  });
});
