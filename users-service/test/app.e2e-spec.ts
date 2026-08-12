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

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  const runId = `${Date.now()}-${process.pid}`;
  const emails = {
    buyer: `e2e-buyer-${runId}@example.com`,
    seller: `e2e-seller-${runId}@example.com`,
    concurrent: `e2e-concurrent-${runId}@example.com`,
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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
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
  });

  afterAll(async () => {
    await usersRepository.delete({ email: In(Object.values(emails)) });
    await app.close();
  });
});
