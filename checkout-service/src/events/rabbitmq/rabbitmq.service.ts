import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';

export interface QueueSubscriptionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl: string = this.configService.get<string>(
        'RABBITMQ_URL',
        'amqp://admin:admin@localhost:5672',
      );

      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('✅ Connected to RabbitMQ successfully');

      // Event listener para monitorar a conexão
      this.connection.on('error', (err: Error): void => {
        this.logger.error('❌ RabbitMQ connection error:', err);
      });

      this.connection.on('close', (): void => {
        this.logger.warn('⚠️ RabbitMQ connection closed');
      });

      this.connection.on('blocked', (reason: string): void => {
        this.logger.warn('⚠️ RabbitMQ connection blocked:', reason);
      });

      this.connection.on('unblocked', (): void => {
        this.logger.log('✅ RabbitMQ connection unblocked');
      });
    } catch (error: unknown) {
      this.logger.warn(
        '⚠️ Failed to connect to RabbitMQ, cotinuing wihout message queue:',
        this.errorMessage(error),
      );
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.logger.log('✅ RabbitMQ channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        this.logger.log('✅ Disconnected from RabbitMQ');
      }
    } catch (error: unknown) {
      this.logger.error('❌ Error disconnecting from RabbitMQ:', error);
    }
  }

  getChannel(): amqp.Channel {
    return this.channel;
  }

  getConnection(): amqp.ChannelModel {
    return this.connection;
  }

  async publishMessage(
    exchange: string,
    routingKey: string,
    message: unknown,
  ): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.channel.assertExchange(exchange, 'topic', { durable: true });
      const messageBuffer: Buffer = Buffer.from(JSON.stringify(message));

      const published: boolean = this.channel.publish(
        exchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          timestamp: Date.now(),
          contentType: 'application/json',
        },
      );

      if (!published) {
        throw new Error('Failed to publish message to RabbitMQ');
      }
      this.logger.log(`✅ Message published to ${exchange}:${routingKey}`);
      this.logger.debug(`Message content: ${JSON.stringify(message)}`);
    } catch (error: unknown) {
      this.logger.error('❌ Error publishing message to RabbitMQ:', error);
      throw error;
    }
  }

  async subscribeToQueue(
    queueName: string,
    exchange: string,
    routingKey: string,
    callback: (message: unknown) => Promise<void>,
    options: QueueSubscriptionOptions = {},
  ): Promise<void> {
    const maxRetries: number = options.maxRetries ?? 3;
    const retryDelayMs: number = options.retryDelayMs ?? 30000;

    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.channel.assertExchange(exchange, 'topic', {
        durable: true,
      });

      const retryExchange = `${exchange}.retry.dlx`;
      const deadLetterExchange = `${exchange}.dlx`;
      await this.channel.assertExchange(retryExchange, 'topic', {
        durable: true,
      });
      await this.channel.assertExchange(deadLetterExchange, 'topic', {
        durable: true,
      });

      const retryQueueName = `${queueName}.retry`;
      const retryRoutingKey = `${routingKey}.retry`;
      await this.channel.assertQueue(retryQueueName, {
        durable: true,
        arguments: {
          'x-message-ttl': retryDelayMs,
          'x-dead-letter-exchange': exchange,
          'x-dead-letter-routing-key': routingKey,
        },
      });
      await this.channel.bindQueue(
        retryQueueName,
        retryExchange,
        retryRoutingKey,
      );

      const deadLetterQueueName = `${queueName}.dlq`;
      const deadLetterRoutingKey = `${routingKey}.dlq`;
      await this.channel.assertQueue(deadLetterQueueName, { durable: true });
      await this.channel.bindQueue(
        deadLetterQueueName,
        deadLetterExchange,
        deadLetterRoutingKey,
      );

      const queue: amqp.Replies.AssertQueue = await this.channel.assertQueue(
        queueName,
        {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000,
            'x-max-length': 10000,
            'x-dead-letter-exchange': retryExchange,
            'x-dead-letter-routing-key': retryRoutingKey,
          },
        },
      );

      await this.channel.bindQueue(queue.queue, exchange, routingKey);

      await this.channel.prefetch(1);

      await this.channel.consume(
        queue.queue,
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (msg: amqp.ConsumeMessage | null): Promise<void> => {
          if (msg) {
            try {
              const message: unknown = JSON.parse(msg.content.toString());
              this.logger.log(`📨 Message received from queue: ${queueName}`);
              this.logger.debug(`Message content: ${JSON.stringify(message)}`);
              await callback(message);

              this.channel.ack(msg);

              this.logger.log(
                `✅ Message processed succesfully from queue: ${queueName}`,
              );
            } catch (error: unknown) {
              this.logger.error(`❌ Error processing message:`, error);
              const retryCount: number = this.getRetryCount(msg);
              if (retryCount < maxRetries) {
                this.channel.nack(msg, false, false);
                return;
              }

              const publishedToDlq: boolean = this.channel.publish(
                deadLetterExchange,
                deadLetterRoutingKey,
                msg.content,
                {
                  persistent: true,
                  headers: msg.properties.headers,
                },
              );

              if (publishedToDlq) {
                this.channel.ack(msg);
              } else {
                this.channel.nack(msg, false, false);
              }
            }
          }
        },
      );

      this.logger.log(
        `✅ Subscribed to queue: ${queueName} with routing key: ${routingKey}`,
      );
    } catch (error: unknown) {
      this.logger.error(`❌ Error subscribing to queue ${queueName}:`, error);
    }
  }

  private getRetryCount(message: amqp.ConsumeMessage): number {
    const deaths: unknown = message.properties.headers?.['x-death'];
    if (!Array.isArray(deaths)) return 0;

    let total = 0;
    for (const death of deaths as unknown[]) {
      if (!this.isDeathHeader(death) || death.queue.endsWith('.retry')) {
        continue;
      }
      total += death.count;
    }
    return total;
  }

  private isDeathHeader(
    input: unknown,
  ): input is { count: number; queue: string } {
    if (typeof input !== 'object' || input === null) return false;
    const value: Record<string, unknown> = input as Record<string, unknown>;
    return (
      typeof value.count === 'number' &&
      Number.isFinite(value.count) &&
      typeof value.queue === 'string'
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
