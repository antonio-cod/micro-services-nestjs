import { HttpService } from '@nestjs/axios';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const jwtSecret = 'gateway-e2e-jwt-secret';
process.env.JWT_SECRET = jwtSecret;

describe('users-service integration through the gateway (e2e)', () => {
  let app: INestApplication<App>;
  let httpService: { get: jest.Mock; request: jest.Mock };
  const user = {
    id: '91afac99-0cd9-4438-945e-2766594a725c',
    email: 'buyer@example.com',
    firstName: 'Maria',
    lastName: 'Silva',
    role: 'buyer',
    status: 'active',
  };
  const token = new JwtService({ secret: jwtSecret }).sign({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  beforeAll(async () => {
    httpService = {
      get: jest.fn(() =>
        of({
          data: { userId: user.id, email: user.email, role: user.role },
          status: 200,
        } as AxiosResponse),
      ),
      request: jest.fn((config: { url: string }) => {
        if (config.url.endsWith('/auth/register')) {
          return of({ data: user, status: 201 } as AxiosResponse);
        }
        if (config.url.endsWith('/auth/login')) {
          return of({ data: { user, token }, status: 200 } as AxiosResponse);
        }
        if (config.url.includes('/users/profile')) {
          return of({ data: user, status: 200 } as AxiosResponse);
        }
        return of({ data: [{ ...user, role: 'seller' }], status: 200 });
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  it('executes register, login, profile and sellers through one gateway', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: user.email,
        password: 'secret123',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      })
      .expect(201)
      .expect(user);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'secret123' })
      .expect(200);
    expect(loginResponse.body.token).toBe(token);

    await request(app.getHttpServer())
      .get('/users/profile?include=role')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(user);

    await request(app.getHttpServer())
      .get('/users/sellers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([{ ...user, role: 'seller' }]);

    expect(httpService.get).toHaveBeenCalledTimes(2);
    for (const validationCall of httpService.get.mock.calls) {
      expect(validationCall[1].headers.Authorization).toBe(`Bearer ${token}`);
    }
    const protectedCalls = httpService.request.mock.calls.filter(([config]) =>
      config.url.includes('/users/'),
    );
    expect(protectedCalls).toHaveLength(2);
    expect(protectedCalls[0][0]).toMatchObject({
      url: expect.stringContaining('/users/profile?include=role'),
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/users/profile').expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
