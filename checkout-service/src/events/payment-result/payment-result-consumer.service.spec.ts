import { OrdersService } from '../../orders/orders.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentResultConsumerService } from './payment-result-consumer.service';

const message = {
  paymentId: 'payment-id',
  orderId: 'order-id',
  userId: 'user-id',
  amount: 25.5,
  paymentMethod: 'pix',
  status: 'approved',
  transactionId: 'transaction-id',
  rejectionReason: null,
  processedAt: '2026-08-15T10:00:00.000Z',
} as const;

describe('PaymentResultConsumerService', () => {
  const rabbitmqService = { subscribeToQueue: jest.fn() };
  const ordersService = { applyPaymentResult: jest.fn() };
  let service: PaymentResultConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    rabbitmqService.subscribeToQueue.mockResolvedValue(undefined);
    ordersService.applyPaymentResult.mockResolvedValue(undefined);
    service = new PaymentResultConsumerService(
      rabbitmqService as unknown as RabbitmqService,
      ordersService as unknown as OrdersService,
    );
  });

  it('subscribes to the payment result queue with bounded retries', async () => {
    await service.onApplicationBootstrap();

    expect(rabbitmqService.subscribeToQueue).toHaveBeenCalledWith(
      'payment_result_queue',
      'payments',
      'payment.result',
      expect.any(Function),
      { maxRetries: 3, retryDelayMs: 30000 },
    );
  });

  it('validates and forwards the result to the order domain', async () => {
    await service.consume(message);

    expect(ordersService.applyPaymentResult).toHaveBeenCalledWith(message);
  });

  it('propagates validation and domain failures', async () => {
    await expect(service.consume({ status: 'approved' })).rejects.toThrow();

    ordersService.applyPaymentResult.mockRejectedValue(
      new Error('database failure'),
    );
    await expect(service.consume(message)).rejects.toThrow('database failure');
  });
});
