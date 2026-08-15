import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/payment-status.enum';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentResultPublisherService } from './payment-result-publisher.service';

describe('PaymentResultPublisherService', () => {
  let rabbitmqService: { publishMessage: jest.Mock };
  let publisher: PaymentResultPublisherService;

  beforeEach(() => {
    rabbitmqService = {
      publishMessage: jest.fn().mockResolvedValue(undefined),
    };
    publisher = new PaymentResultPublisherService(
      rabbitmqService as unknown as RabbitmqService,
    );
  });

  it.each([
    [PaymentStatus.APPROVED, 'transaction-id', null],
    [PaymentStatus.REJECTED, null, 'Cartão recusado pela operadora'],
  ])(
    'publishes a persisted %s payment result',
    async (status, transactionId, rejectionReason) => {
      const payment = createPayment({
        status,
        transactionId,
        rejectionReason,
      });

      await publisher.publish(payment);

      expect(rabbitmqService.publishMessage).toHaveBeenCalledWith(
        'payments',
        'payment.result',
        {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          amount: 25.99,
          paymentMethod: 'pix',
          status,
          transactionId,
          rejectionReason,
          processedAt: '2026-08-15T20:00:00.000Z',
        },
      );
    },
  );

  it.each([
    createPayment({ status: PaymentStatus.PENDING, processedAt: null }),
    createPayment({ status: PaymentStatus.APPROVED, transactionId: null }),
    createPayment({
      status: PaymentStatus.REJECTED,
      transactionId: null,
      rejectionReason: null,
    }),
  ])('rejects an incomplete or inconsistent payment', async (payment) => {
    await expect(publisher.publish(payment)).rejects.toThrow();
    expect(rabbitmqService.publishMessage).not.toHaveBeenCalled();
  });

  function createPayment(overrides: Partial<Payment>): Payment {
    return {
      id: 'payment-id',
      orderId: '10b1b4ad-9fe5-4dd4-b809-c4a8efb6cbf9',
      userId: '9b19eae5-a516-4a7a-a447-294a85bbc4bf',
      amount: 25.99,
      paymentMethod: 'pix',
      status: PaymentStatus.APPROVED,
      transactionId: 'transaction-id',
      rejectionReason: null,
      processedAt: new Date('2026-08-15T20:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
});
