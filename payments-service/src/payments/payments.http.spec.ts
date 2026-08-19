import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('Payments HTTP', () => {
  const orderId = '10b1b4ad-9fe5-4dd4-b809-c4a8efb6cbf9';
  let app: INestApplication<App>;
  let paymentsService: { findByOrderId: jest.Mock };

  beforeEach(async () => {
    paymentsService = { findByOrderId: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(() => app.close());

  it('returns a payment by order id', async () => {
    paymentsService.findByOrderId.mockResolvedValue({
      orderId,
      status: 'approved',
      amount: 25,
    });

    await request(app.getHttpServer())
      .get(`/payments/${orderId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ orderId, status: 'approved', amount: 25 });
      });
  });

  it('rejects an invalid order id', () =>
    request(app.getHttpServer()).get('/payments/not-a-uuid').expect(400));
});
