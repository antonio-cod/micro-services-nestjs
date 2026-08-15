import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { HealthController } from './../src/health/health.controller';
import { PaymentsController } from './../src/payments/payments.controller';
import { PaymentsService } from './../src/payments/payments.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, HealthController, PaymentsController],
      providers: [
        AppService,
        {
          provide: PaymentsService,
          useValue: { findByOrderId: jest.fn() },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'healthy' });
  });

  afterEach(async () => {
    await app.close();
  });
});
