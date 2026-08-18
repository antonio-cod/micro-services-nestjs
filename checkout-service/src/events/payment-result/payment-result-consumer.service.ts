import {
  forwardRef,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import {
  parsePaymentResultMessage,
  PaymentResultMessage,
} from '../payment-result.interface';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class PaymentResultConsumerService implements OnApplicationBootstrap {
  private readonly queueName = 'payment_result_queue';
  private readonly exchange = 'payments';
  private readonly routingKey = 'payment.result';

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitmqService.subscribeToQueue(
      this.queueName,
      this.exchange,
      this.routingKey,
      (input: unknown): Promise<void> => this.consume(input),
      { maxRetries: 3, retryDelayMs: 30000 },
    );
  }

  async consume(input: unknown): Promise<void> {
    const message: PaymentResultMessage = parsePaymentResultMessage(input);
    await this.ordersService.applyPaymentResult(message);
  }
}
