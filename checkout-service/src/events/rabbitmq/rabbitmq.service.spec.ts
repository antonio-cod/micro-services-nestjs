import { ConfigService } from '@nestjs/config';
import { Channel } from 'amqplib';
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
});
