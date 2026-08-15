import { Injectable } from '@nestjs/common';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/payment-status.enum';
import { PaymentResultMessage } from '../payment-result.interface';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class PaymentResultPublisherService {
  private readonly exchange = 'payments';
  private readonly routingKey = 'payment.result';

  constructor(private readonly rabbitmqService: RabbitmqService) {}

  async publish(payment: Payment): Promise<void> {
    const message = this.toMessage(payment);
    await this.rabbitmqService.publishMessage(
      this.exchange,
      this.routingKey,
      message,
    );
  }

  private toMessage(payment: Payment): PaymentResultMessage {
    this.validateFinalPayment(payment);

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionId: payment.transactionId,
      rejectionReason: payment.rejectionReason,
      processedAt: payment.processedAt.toISOString(),
    };
  }

  private validateFinalPayment(payment: Payment): asserts payment is Payment & {
    status: PaymentStatus.APPROVED | PaymentStatus.REJECTED;
    processedAt: Date;
  } {
    if (!payment.id || !payment.processedAt) {
      throw new Error('Payment result is incomplete');
    }

    if (
      payment.status === PaymentStatus.APPROVED &&
      payment.transactionId &&
      payment.rejectionReason === null
    ) {
      return;
    }

    if (
      payment.status === PaymentStatus.REJECTED &&
      payment.transactionId === null &&
      payment.rejectionReason
    ) {
      return;
    }

    throw new Error('Payment is not in a consistent final state');
  }
}
