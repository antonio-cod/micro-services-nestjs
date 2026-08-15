import { Test } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  it('delegates lookup by order id', async () => {
    const payment = { orderId: 'order-id' };
    const paymentsService = {
      findByOrderId: jest.fn().mockResolvedValue(payment),
    };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    await expect(
      module.get(PaymentsController).findByOrderId('order-id'),
    ).resolves.toBe(payment);
  });
});
