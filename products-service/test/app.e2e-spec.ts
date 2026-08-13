import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';

const jwtSecret = 'products-service-e2e-jwt-secret';
process.env.JWT_SECRET = jwtSecret;

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) returns 401 without a token', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/ (GET) accepts a JWT signed with the shared secret', () => {
    const token = new JwtService().sign(
      {
        sub: '91afac99-0cd9-4438-945e-2766594a725c',
        email: 'buyer@example.com',
        role: 'buyer',
      },
      { secret: jwtSecret, expiresIn: 60 },
    );

    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
