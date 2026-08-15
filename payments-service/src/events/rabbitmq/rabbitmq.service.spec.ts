/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq.service';

describe('RabbitmqService publishing', () => {
  let service: RabbitmqService;
  let channel: { assertExchange: jest.Mock; publish: jest.Mock };

  beforeEach(() => {
    service = new RabbitmqService({} as ConfigService);
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
    };
    setChannel(channel);
  });

  it('publishes a persistent JSON message to a durable topic exchange', async () => {
    await service.publishMessage('payments', 'payment.result', { id: '1' });

    expect(channel.assertExchange).toHaveBeenCalledWith('payments', 'topic', {
      durable: true,
    });
    expect(channel.publish).toHaveBeenCalledWith(
      'payments',
      'payment.result',
      Buffer.from('{"id":"1"}'),
      expect.objectContaining({
        persistent: true,
        contentType: 'application/json',
        timestamp: expect.any(Number),
      }),
    );
  });

  it('rejects when the channel is unavailable', async () => {
    setChannel(undefined);
    await expect(
      service.publishMessage('payments', 'payment.result', {}),
    ).rejects.toThrow('RabbitMQ channel not available');
  });

  it('rejects when the channel refuses the publish buffer', async () => {
    channel.publish.mockReturnValue(false);
    await expect(
      service.publishMessage('payments', 'payment.result', {}),
    ).rejects.toThrow('Failed to publish message to RabbitMQ');
  });

  it('propagates channel errors', async () => {
    channel.assertExchange.mockRejectedValue(new Error('channel closed'));
    await expect(
      service.publishMessage('payments', 'payment.result', {}),
    ).rejects.toThrow('channel closed');
  });

  function setChannel(value: unknown): void {
    (service as unknown as { channel: unknown }).channel = value;
  }
});
