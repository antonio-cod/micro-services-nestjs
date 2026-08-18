import { PaymentMethod } from '../../orders/entities/order.entity';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentQueueService } from './payment-queue.service';
import { MetricsService } from '../../metrics/metrics.service';

describe('PaymentQueueService', () => {
  it('publishes a typed order to the payments exchange and routing key', async () => {
    const rabbitmqService = {
      publishMessage: jest.fn().mockResolvedValue(undefined),
    };
    const metricsService = { recordRabbitMqMessagePublished: jest.fn() };
    const service = new PaymentQueueService(
      rabbitmqService as unknown as RabbitmqService,
      metricsService as unknown as MetricsService,
    );

    await service.publishPaymentOrder({
      orderId: '04358217-51aa-4c70-b40e-2294db6272ae',
      userId: '91afac99-0cd9-4438-945e-2766594a725c',
      amount: 25.5,
      items: [
        {
          productId: 'f18d3b2f-fc2d-4867-b62f-708497172963',
          quantity: 2,
          price: 12.75,
        },
      ],
      paymentMethod: PaymentMethod.PIX,
    });

    expect(rabbitmqService.publishMessage).toHaveBeenCalledWith(
      'payments',
      'payment.order',
      expect.objectContaining({
        amount: 25.5,
        paymentMethod: PaymentMethod.PIX,
      }),
    );
    expect(metricsService.recordRabbitMqMessagePublished).toHaveBeenCalledWith(
      'payment_queue',
    );
  });

  it('propagates publisher failures', async () => {
    const rabbitmqService = {
      publishMessage: jest.fn().mockRejectedValue(new Error('unavailable')),
    };
    const metricsService = { recordRabbitMqMessagePublished: jest.fn() };
    const service = new PaymentQueueService(
      rabbitmqService as unknown as RabbitmqService,
      metricsService as unknown as MetricsService,
    );

    await expect(
      service.publishPaymentOrder({
        orderId: '04358217-51aa-4c70-b40e-2294db6272ae',
        userId: '91afac99-0cd9-4438-945e-2766594a725c',
        amount: 10,
        items: [
          {
            productId: 'f18d3b2f-fc2d-4867-b62f-708497172963',
            quantity: 1,
            price: 10,
          },
        ],
        paymentMethod: PaymentMethod.CREDIT_CARD,
      }),
    ).rejects.toThrow('unavailable');
    expect(
      metricsService.recordRabbitMqMessagePublished,
    ).not.toHaveBeenCalled();
  });
});
