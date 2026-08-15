import { ConfigService } from '@nestjs/config';
import { Channel, ConsumeMessage } from 'amqplib';
import { RabbitmqService } from './rabbitmq.service';

describe('RabbitmqService publication', () => {
  let service: RabbitmqService;

  beforeEach(() => {
    service = new RabbitmqService({} as ConfigService);
  });

  it('rejects publication when the channel is unavailable', async () => {
    await expect(
      service.publishMessage('payments', 'payment.order', { id: 'order' }),
    ).rejects.toThrow('RabbitMQ channel not available');
  });

  it('rejects publication when the channel refuses the message', async () => {
    const channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(false),
    };
    Object.assign(service, { channel: channel as unknown as Channel });

    await expect(
      service.publishMessage('payments', 'payment.order', { id: 'order' }),
    ).rejects.toThrow('Failed to publish message to RabbitMQ');
  });

  it('propagates channel publication errors', async () => {
    const channel = {
      assertExchange: jest.fn().mockRejectedValue(new Error('channel error')),
      publish: jest.fn(),
    };
    Object.assign(service, { channel: channel as unknown as Channel });

    await expect(
      service.publishMessage('payments', 'payment.order', { id: 'order' }),
    ).rejects.toThrow('channel error');
  });

  it('declares and binds the main, retry and dead-letter topology', async () => {
    const channel = createSubscriptionChannel();
    Object.assign(service, { channel: channel as unknown as Channel });

    await service.subscribeToQueue(
      'payment_result_queue',
      'payments',
      'payment.result',
      jest.fn(),
      { maxRetries: 3, retryDelayMs: 30000 },
    );

    expect(channel.assertExchange).toHaveBeenCalledWith('payments', 'topic', {
      durable: true,
    });
    expect(channel.assertExchange).toHaveBeenCalledWith(
      'payments.retry.dlx',
      'topic',
      { durable: true },
    );
    expect(channel.assertExchange).toHaveBeenCalledWith(
      'payments.dlx',
      'topic',
      { durable: true },
    );
    expect(channel.assertQueue).toHaveBeenCalledWith(
      'payment_result_queue.retry',
      {
        durable: true,
        arguments: {
          'x-message-ttl': 30000,
          'x-dead-letter-exchange': 'payments',
          'x-dead-letter-routing-key': 'payment.result',
        },
      },
    );
    expect(channel.assertQueue).toHaveBeenCalledWith(
      'payment_result_queue.dlq',
      { durable: true },
    );
    expect(channel.assertQueue).toHaveBeenCalledWith('payment_result_queue', {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000,
        'x-max-length': 10000,
        'x-dead-letter-exchange': 'payments.retry.dlx',
        'x-dead-letter-routing-key': 'payment.result.retry',
      },
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'payment_result_queue',
      'payments',
      'payment.result',
    );
    expect(channel.prefetch).toHaveBeenCalledWith(1);
  });

  it('acks only after successful processing', async () => {
    const channel = createSubscriptionChannel();
    Object.assign(service, { channel: channel as unknown as Channel });
    let finishProcessing: (() => void) | undefined;
    const callback = jest.fn(
      (): Promise<void> =>
        new Promise<void>((resolve: () => void): void => {
          finishProcessing = resolve;
        }),
    );
    await service.subscribeToQueue(
      'payment_result_queue',
      'payments',
      'payment.result',
      callback,
    );
    const handler = channel.getHandler();
    const processing = handler(createMessage());

    await Promise.resolve();
    expect(channel.ack).not.toHaveBeenCalled();
    finishProcessing?.();
    await processing;
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('rejects failed messages for retry before the limit', async () => {
    const channel = createSubscriptionChannel();
    Object.assign(service, { channel: channel as unknown as Channel });
    await service.subscribeToQueue(
      'payment_result_queue',
      'payments',
      'payment.result',
      jest.fn().mockRejectedValue(new Error('processing failure')),
    );
    const handler = channel.getHandler();

    await handler(createMessage(2));

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('publishes to the DLQ and acknowledges after the retry limit', async () => {
    const channel = createSubscriptionChannel();
    Object.assign(service, { channel: channel as unknown as Channel });
    await service.subscribeToQueue(
      'payment_result_queue',
      'payments',
      'payment.result',
      jest.fn().mockRejectedValue(new Error('processing failure')),
    );
    const handler = channel.getHandler();

    await handler(createMessage(3));

    expect(channel.publish).toHaveBeenCalledWith(
      'payments.dlx',
      'payment.result.dlq',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });
});

function createSubscriptionChannel() {
  let handler: ((message: ConsumeMessage | null) => Promise<void>) | undefined;
  return {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest
      .fn()
      .mockImplementation((queue: string) => Promise.resolve({ queue })),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn(
      (
        _queue: string,
        callback: (message: ConsumeMessage | null) => Promise<void>,
      ): Promise<{ consumerTag: string }> => {
        handler = callback;
        return Promise.resolve({ consumerTag: 'consumer' });
      },
    ),
    ack: jest.fn(),
    nack: jest.fn(),
    publish: jest.fn().mockReturnValue(true),
    getHandler: (): ((message: ConsumeMessage) => Promise<void>) => {
      if (!handler) throw new Error('Consumer was not registered');
      return handler;
    },
  };
}

function createMessage(retryCount = 0): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ orderId: 'order-id' })),
    fields: {} as ConsumeMessage['fields'],
    properties: {
      headers:
        retryCount > 0
          ? {
              'x-death': [{ count: retryCount, queue: 'payment_result_queue' }],
            }
          : {},
      contentType: 'application/json',
    } as ConsumeMessage['properties'],
  };
}
