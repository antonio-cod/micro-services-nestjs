import { Module } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { ConfigModule } from '@nestjs/config';
import { PaymentConsumerService } from './payment-consumer/payment-consumer.service';
import { PaymentQueueService } from './payment-queue/payment-queue.service';

@Module({
  imports: [ConfigModule],
  providers: [RabbitmqService, PaymentQueueService, PaymentConsumerService],
})
export class EventsModule {}
