import { forwardRef, Module } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { ConfigModule } from '@nestjs/config';
import { PaymentQueueService } from './payment-queue/payment-queue.service';
import { OrdersModule } from '../orders/orders.module';
import { PaymentResultConsumerService } from './payment-result/payment-result-consumer.service';

@Module({
  imports: [ConfigModule, forwardRef(() => OrdersModule)],
  providers: [
    RabbitmqService,
    PaymentQueueService,
    PaymentResultConsumerService,
  ],
  exports: [RabbitmqService, PaymentQueueService],
})
export class EventsModule {}
