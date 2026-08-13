import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from './auth.module';
import { Public } from './decorators/public.decorator';
import {
  AuthenticatedUser,
  UserRole,
} from './interfaces/jwt-payload.interface';

const jwtSecret = 'checkout-service-http-test-secret';
let protectedHandlerCalls = 0;

@Controller('test-auth')
class TestAuthController {
  @Get('protected')
  protectedRoute(
    @Req() req: Request & { user: AuthenticatedUser },
  ): AuthenticatedUser {
    protectedHandlerCalls += 1;
    return req.user;
  }

  @Public()
  @Get('public')
  publicRoute(): string {
    return 'public';
  }

  @Get('still-protected')
  stillProtected(): string {
    return 'protected';
  }
}

@Public()
@Controller('test-public-controller')
class TestPublicController {
  @Get()
  publicRoute(): string {
    return 'public controller';
  }
}

describe('JWT authentication (HTTP)', () => {
  let app: INestApplication<App>;
  const jwtService = new JwtService();

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
      controllers: [TestAuthController, TestPublicController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    protectedHandlerCalls = 0;
  });

  afterAll(async () => app.close());

  function tokenFor(role: UserRole, secret = jwtSecret, expiresIn = 60) {
    return jwtService.sign(
      {
        sub: '91afac99-0cd9-4438-945e-2766594a725c',
        email: `${role}@example.com`,
        role,
        password: 'must-not-leak',
      },
      { secret, expiresIn },
    );
  }

  it.each<UserRole>(['seller', 'buyer'])(
    'accepts a valid %s token and exposes only authenticated fields',
    async (role) => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', `Bearer ${tokenFor(role)}`)
        .expect(200);

      expect(response.body).toEqual({
        id: '91afac99-0cd9-4438-945e-2766594a725c',
        email: `${role}@example.com`,
        role,
      });
      expect(protectedHandlerCalls).toBe(1);
    },
  );

  it.each([
    ['missing authorization', undefined],
    ['Basic authorization', 'Basic credentials'],
    ['empty Bearer token', 'Bearer '],
    ['malformed token', 'Bearer malformed.token'],
    ['expired token', `Bearer ${tokenFor('buyer', jwtSecret, -1)}`],
    ['different signature', `Bearer ${tokenFor('seller', 'other-secret')}`],
  ])('rejects %s before reaching the handler', async (_case, authorization) => {
    const pendingRequest = request(app.getHttpServer()).get(
      '/test-auth/protected',
    );
    if (authorization) pendingRequest.set('Authorization', authorization);

    await pendingRequest.expect(401);
    expect(protectedHandlerCalls).toBe(0);
  });

  it.each(['/test-auth/public', '/test-public-controller'])(
    'allows public resource %s without a valid token',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(200);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer invalid.token')
        .expect(200);
    },
  );

  it('does not make sibling routes public', async () => {
    await request(app.getHttpServer())
      .get('/test-auth/still-protected')
      .expect(401);
  });
});
