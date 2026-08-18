import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentOrderMessage } from '../events/payment-queue.interface';
import { Payment } from './entities/payment.entity';
import { FakePaymentGatewayService } from './fake-payment-gateway.service';
import { PaymentStatus } from './payment-status.enum';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly paymentGateway: FakePaymentGatewayService,
    private readonly metricsService: MetricsService,
  ) {}

  async processPayment(message: PaymentOrderMessage): Promise<Payment> {
    let payment = await this.paymentsRepository.findOneBy({
      orderId: message.orderId,
    });

    if (payment && payment.status !== PaymentStatus.PENDING) {
      return payment;
    }

    if (!payment) {
      payment = this.paymentsRepository.create({
        orderId: message.orderId,
        userId: message.userId,
        amount: message.amount,
        paymentMethod: message.paymentMethod,
        status: PaymentStatus.PENDING,
        transactionId: null,
        rejectionReason: null,
        processedAt: null,
      });
      payment = await this.paymentsRepository.save(payment);
    }

    const result = await this.paymentGateway.process(payment.amount);
    payment.processedAt = new Date();

    if (result.approved) {
      payment.status = PaymentStatus.APPROVED;
      payment.transactionId = result.transactionId ?? null;
      payment.rejectionReason = null;
    } else {
      payment.status = PaymentStatus.REJECTED;
      payment.transactionId = null;
      payment.rejectionReason = result.rejectionReason ?? null;
    }

    const savedPayment = await this.paymentsRepository.save(payment);

    if (savedPayment.status === PaymentStatus.APPROVED) {
      this.metricsService.recordPaymentApproved();
    } else {
      this.metricsService.recordPaymentRejected(savedPayment.rejectionReason);
    }

    return savedPayment;
  }

  async findByOrderId(orderId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOneBy({ orderId });
    if (!payment) {
      throw new NotFoundException(`Payment for order ${orderId} not found`);
    }
    return payment;
  }
}
