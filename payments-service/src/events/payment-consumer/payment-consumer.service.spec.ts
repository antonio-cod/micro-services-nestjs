/* eslint-disable @typescript-eslint/unbound-method */
import { PaymentOrderMessage } from '../payment-queue.interface';
import { PaymentQueueService } from '../payment-queue/payment-queue.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentsService } from '../../payments/payments.service';
import { PaymentConsumerService } from './payment-consumer.service';
import { PaymentResultPublisherService } from '../payment-result/payment-result-publisher.service';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/payment-status.enum';

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
  let publisher: jest.Mocked<PaymentResultPublisherService>;

  beforeEach(() => {
    paymentsService = {
      processPayment: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;
    publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PaymentResultPublisherService>;
    consumer = new PaymentConsumerService(
      {} as PaymentQueueService,
      {} as RabbitmqService,
      paymentsService,
      publisher,
    );
  });

  it('awaits payment processing before recording success', async () => {
    const payment = { status: PaymentStatus.APPROVED } as Payment;
    paymentsService.processPayment.mockResolvedValue(payment);

    await consumer['processPaymentOrder'](message);

    expect(paymentsService.processPayment).toHaveBeenCalledWith(message);
    expect(publisher.publish).toHaveBeenCalledWith(payment);
    expect(
      paymentsService.processPayment.mock.invocationCallOrder[0],
    ).toBeLessThan(publisher.publish.mock.invocationCallOrder[0]);
    expect(consumer.getMetrics()).toMatchObject({
      totalProcessed: 1,
      totalSuccess: 1,
      totalFailed: 0,
    });
  });

  it('propagates publication failures after payment persistence', async () => {
    paymentsService.processPayment.mockResolvedValue({
      status: PaymentStatus.APPROVED,
    } as Payment);
    publisher.publish.mockRejectedValue(new Error('publish failed'));

    await expect(consumer['processPaymentOrder'](message)).rejects.toThrow(
      'publish failed',
    );
    expect(consumer.getMetrics()).toMatchObject({
      totalProcessed: 1,
      totalSuccess: 0,
      totalFailed: 1,
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
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('preserves validation before invoking payment processing', async () => {
    await expect(
      consumer['processPaymentOrder']({ ...message, items: [] }),
    ).rejects.toThrow('Invalid payment message received');
    expect(paymentsService.processPayment).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
