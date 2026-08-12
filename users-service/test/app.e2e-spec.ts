import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { User } from './../src/users/entities/user.entity';
import { UserRole } from './../src/users/enums/user-role.enum';
import { UserStatus } from './../src/users/enums/user-status.enum';
import { compare, getRounds } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

const jwtSecret = 'users-service-e2e-jwt-secret';
process.env.JWT_SECRET = jwtSecret;

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

interface LoginResponseBody {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  const runId = `${Date.now()}-${process.pid}`;
  const emails = {
    buyer: `e2e-buyer-${runId}@example.com`,
    seller: `e2e-seller-${runId}@example.com`,
    concurrent: `e2e-concurrent-${runId}@example.com`,
    inactive: `e2e-inactive-${runId}@example.com`,
    publicRoute: `e2e-public-${runId}@example.com`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    usersRepository = moduleFixture.get(DataSource).getRepository(User);
  });

  describe('POST /auth/register', () => {
    it.each([
      [UserRole.BUYER, emails.buyer],
      [UserRole.SELLER, emails.seller],
    ])(
      'registers an active %s without exposing password',
      async (role, email) => {
        const password = 'secret123';
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email,
            password,
            firstName: 'Maria',
            lastName: 'Silva',
            role,
          })
          .expect(201);

        expect(response.body).toMatchObject({
          email,
          firstName: 'Maria',
          lastName: 'Silva',
          role,
          status: UserStatus.ACTIVE,
        });
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
        expect(response.body).not.toHaveProperty('password');
        expect(JSON.stringify(response.body)).not.toContain(password);

        const persistedUser = await usersRepository.findOneByOrFail({ email });
        expect(persistedUser.password).not.toBe(password);
        await expect(compare(password, persistedUser.password)).resolves.toBe(
          true,
        );
        expect(getRounds(persistedUser.password)).toBe(10);
        expect(persistedUser.status).toBe(UserStatus.ACTIVE);
      },
    );

    it('returns 409 for an email already registered', async () => {
      const input = {
        email: emails.buyer,
        password: 'another-secret',
        firstName: 'Outra',
        lastName: 'Pessoa',
        role: UserRole.BUYER,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(input)
        .expect(409);
      const body = response.body as ErrorResponseBody;

      expect(body).toMatchObject({
        statusCode: 409,
        message: 'Email já cadastrado',
        error: 'Conflict',
      });
      expect(body).not.toHaveProperty('password');
      expect(JSON.stringify(body)).not.toContain(input.password);
      await expect(
        usersRepository.countBy({ email: input.email }),
      ).resolves.toBe(1);
    });

    it('returns every validation error and does not persist the request', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '12345',
          firstName: 'a'.repeat(101),
          lastName: 'a'.repeat(101),
          role: 'admin',
        })
        .expect(400);
      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('email'),
          expect.stringContaining('password'),
          expect.stringContaining('firstName'),
          expect.stringContaining('lastName'),
          expect.stringContaining('role'),
        ]),
      );
      expect(response.body).not.toHaveProperty('password');
    });

    it('rejects missing, null, incorrectly typed, and extra fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: null,
          password: 123456,
          firstName: 'Maria',
          role: UserRole.BUYER,
          status: UserStatus.INACTIVE,
        })
        .expect(400);
      const body = response.body as ErrorResponseBody;

      expect(body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('email'),
          expect.stringContaining('password'),
          expect.stringContaining('lastName'),
          expect.stringContaining('status'),
        ]),
      );
    });

    it('allows only one of two concurrent requests for the same email', async () => {
      const input = {
        email: emails.concurrent,
        password: 'secret123',
        firstName: 'Concurrent',
        lastName: 'User',
        role: UserRole.SELLER,
      };

      const responses = await Promise.all([
        request(app.getHttpServer()).post('/auth/register').send(input),
        request(app.getHttpServer()).post('/auth/register').send(input),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(responses.every(({ body }) => !('password' in body))).toBe(true);
      await expect(
        usersRepository.countBy({ email: input.email }),
      ).resolves.toBe(1);
    });

    it('remains public when an invalid Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', 'Bearer invalid.token')
        .send({
          email: emails.publicRoute,
          password: 'secret123',
          firstName: 'Public',
          lastName: 'Route',
          role: UserRole.BUYER,
        })
        .expect(201);
    });
  });

  describe('POST /auth/login', () => {
    it.each([
      [UserRole.BUYER, emails.buyer],
      [UserRole.SELLER, emails.seller],
    ])(
      'authenticates an active %s and returns a valid JWT',
      async (role, email) => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: 'secret123' })
          .expect(200);
        const body = response.body as LoginResponseBody;

        expect(Object.keys(body).sort()).toEqual(['token', 'user']);
        expect(body.user).toMatchObject({
          email,
          firstName: 'Maria',
          lastName: 'Silva',
          role,
          status: UserStatus.ACTIVE,
        });
        expect(Object.keys(body.user).sort()).toEqual([
          'createdAt',
          'email',
          'firstName',
          'id',
          'lastName',
          'role',
          'status',
          'updatedAt',
        ]);
        expect(typeof body.token).toBe('string');
        expect(JSON.stringify(body)).not.toContain('secret123');
        expect(body.user).not.toHaveProperty('password');

        const payload = await new JwtService().verifyAsync<{
          sub: string;
          email: string;
          role: UserRole;
          iat: number;
          exp: number;
        }>(body.token, { secret: jwtSecret });
        expect(payload).toMatchObject({
          sub: body.user.id,
          email,
          role,
        });
        expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
        expect(payload).not.toHaveProperty('password');
        await expect(
          new JwtService().verifyAsync(body.token, {
            secret: 'different-secret',
          }),
        ).rejects.toThrow();
      },
    );

    it('returns indistinguishable errors for unknown email and wrong password', async () => {
      const unknownResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unknown@example.com', password: 'secret123' })
        .expect(401);
      const wrongPasswordResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emails.buyer, password: 'wrong-password' })
        .expect(401);

      expect(unknownResponse.body).toMatchObject({
        statusCode: 401,
        message: 'Credenciais inválidas',
        error: 'Unauthorized',
      });
      expect(wrongPasswordResponse.body).toEqual(unknownResponse.body);
      expect(unknownResponse.body).not.toHaveProperty('token');
    });

    it('reveals inactive status only after valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: emails.inactive,
          password: 'secret123',
          firstName: 'Inactive',
          lastName: 'User',
          role: UserRole.BUYER,
        })
        .expect(201);
      await usersRepository.update(
        { email: emails.inactive },
        { status: UserStatus.INACTIVE },
      );

      const inactiveResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emails.inactive, password: 'secret123' })
        .expect(401);
      expect(inactiveResponse.body).toMatchObject({
        statusCode: 401,
        message: 'Conta inativa',
        error: 'Unauthorized',
      });
      expect(inactiveResponse.body).not.toHaveProperty('token');

      const wrongPasswordResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emails.inactive, password: 'wrong-password' })
        .expect(401);
      const wrongPasswordBody = wrongPasswordResponse.body as ErrorResponseBody;
      expect(wrongPasswordBody.message).toBe('Credenciais inválidas');
    });

    it.each([
      ['missing fields', {}],
      ['invalid email', { email: 'invalid', password: 'secret123' }],
      ['short password', { email: emails.buyer, password: '12345' }],
      ['null values', { email: null, password: null }],
      ['invalid types', { email: 123, password: 123456 }],
      [
        'extra field',
        { email: emails.buyer, password: 'secret123', role: UserRole.BUYER },
      ],
    ])('rejects %s without issuing a token', async (_scenario, body) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(body)
        .expect(400);
      const errorBody = response.body as ErrorResponseBody;

      expect(errorBody.statusCode).toBe(400);
      expect(errorBody).not.toHaveProperty('token');
      expect(JSON.stringify(errorBody)).not.toContain('secret123');
    });

    it('remains public when an expired Bearer token is provided', async () => {
      const expiredToken = await new JwtService({
        secret: jwtSecret,
      }).signAsync(
        {
          sub: '91afac99-0cd9-4438-945e-2766594a725c',
          email: emails.buyer,
          role: UserRole.BUYER,
        },
        { expiresIn: -1 },
      );

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ email: emails.buyer, password: 'secret123' })
        .expect(200);
    });
  });

  describe('global JWT protection', () => {
    it('allows a protected route with a valid Bearer token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emails.buyer, password: 'secret123' })
        .expect(200);
      const { token } = loginResponse.body as LoginResponseBody;

      await request(app.getHttpServer())
        .get('/')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Hello World!');
    });

    it.each([
      ['without an Authorization header', undefined],
      ['with a non-Bearer scheme', 'Basic credentials'],
      ['with a malformed token', 'Bearer invalid.token'],
      [
        'with an invalid signature',
        `Bearer ${new JwtService({ secret: 'different-secret' }).sign({
          sub: '91afac99-0cd9-4438-945e-2766594a725c',
          email: emails.buyer,
          role: UserRole.BUYER,
        })}`,
      ],
      [
        'with an expired token',
        `Bearer ${new JwtService({ secret: jwtSecret }).sign(
          {
            sub: '91afac99-0cd9-4438-945e-2766594a725c',
            email: emails.buyer,
            role: UserRole.BUYER,
          },
          { expiresIn: -1 },
        )}`,
      ],
    ])('returns 401 %s', async (_scenario, authorization) => {
      const pendingRequest = request(app.getHttpServer()).get('/');

      if (authorization) {
        pendingRequest.set('Authorization', authorization);
      }

      await pendingRequest.expect(401);
    });
  });

  afterAll(async () => {
    await usersRepository.delete({ email: In(Object.values(emails)) });
    await app.close();
  });
});
