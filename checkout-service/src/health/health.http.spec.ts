import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../auth/auth.module';
import { HealthModule } from './health.module';

describe('Health endpoint', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'health-test-secret';
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        HealthModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns the exact public health response', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'checkout-service',
    });
  });
});
