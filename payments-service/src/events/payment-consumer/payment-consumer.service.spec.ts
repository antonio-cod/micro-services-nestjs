/* eslint-disable @typescript-eslint/unbound-method */
import { PaymentOrderMessage } from '../payment-queue.interface';
import { PaymentQueueService } from '../payment-queue/payment-queue.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentsService } from '../../payments/payments.service';
import { PaymentConsumerService } from './payment-consumer.service';

describe('PaymentConsumerService', () => {
  const message: PaymentOrderMessage = {
    orderId: '10b1b4ad-9fe5-4dd4-b809-c4a8efb6cbf9',
    userId: '9b19eae5-a516-4a7a-a447-294a85bbc4bf',
    amount: 25,
    paymentMethod: 'pix',
    items: [{ productId: 'product-id', quantity: 1, price: 25 }],
  };
  let paymentsService: jest.Mocked<PaymentsService>;
  let consumer: PaymentConsumerService;

  beforeEach(() => {
    paymentsService = {
      processPayment: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;
    consumer = new PaymentConsumerService(
      {} as PaymentQueueService,
      {} as RabbitmqService,
      paymentsService,
    );
  });

  it('awaits payment processing before recording success', async () => {
    paymentsService.processPayment.mockResolvedValue({} as never);

    await consumer['processPaymentOrder'](message);

    expect(paymentsService.processPayment).toHaveBeenCalledWith(message);
    expect(consumer.getMetrics()).toMatchObject({
      totalProcessed: 1,
      totalSuccess: 1,
      totalFailed: 0,
    });
  });

  it('records and propagates technical failures', async () => {
    paymentsService.processPayment.mockRejectedValue(
      new Error('database down'),
    );

    await expect(consumer['processPaymentOrder'](message)).rejects.toThrow(
      'database down',
    );
    expect(consumer.getMetrics()).toMatchObject({
      totalProcessed: 1,
      totalSuccess: 0,
      totalFailed: 1,
    });
  });

  it('preserves validation before invoking payment processing', async () => {
    await expect(
      consumer['processPaymentOrder']({ ...message, items: [] }),
    ).rejects.toThrow('Invalid payment message received');
    expect(paymentsService.processPayment).not.toHaveBeenCalled();
  });
});
