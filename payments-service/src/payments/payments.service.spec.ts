/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaymentOrderMessage } from '../events/payment-queue.interface';
import { Payment } from './entities/payment.entity';
import { FakePaymentGatewayService } from './fake-payment-gateway.service';
import { PaymentStatus } from './payment-status.enum';
import { PaymentsService } from './payments.service';
import { MetricsService } from '../metrics/metrics.service';

describe('PaymentsService', () => {
  const message: PaymentOrderMessage = {
    orderId: '10b1b4ad-9fe5-4dd4-b809-c4a8efb6cbf9',
    userId: '9b19eae5-a516-4a7a-a447-294a85bbc4bf',
    amount: 25,
    paymentMethod: 'pix',
    items: [{ productId: 'product', quantity: 1, price: 25 }],
  };
  let repository: jest.Mocked<Repository<Payment>>;
  let gateway: jest.Mocked<FakePaymentGatewayService>;
  let service: PaymentsService;
  let metrics: jest.Mocked<
    Pick<MetricsService, 'recordPaymentApproved' | 'recordPaymentRejected'>
  >;

  beforeEach(() => {
    repository = {
      findOneBy: jest.fn(),
      create: jest.fn((data) => data as Payment),
      save: jest.fn((payment) => Promise.resolve({ ...payment } as Payment)),
    } as unknown as jest.Mocked<Repository<Payment>>;
    gateway = {
      process: jest.fn(),
    } as unknown as jest.Mocked<FakePaymentGatewayService>;
    metrics = {
      recordPaymentApproved: jest.fn(),
      recordPaymentRejected: jest.fn(),
    };
    service = new PaymentsService(
      repository,
      gateway,
      metrics as unknown as MetricsService,
    );
  });

  it('persists pending before the gateway and then approves', async () => {
    repository.findOneBy.mockResolvedValue(null);
    gateway.process.mockResolvedValue({
      approved: true,
      transactionId: 'transaction-id',
    });

    const result = await service.processPayment(message);

    expect(repository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: PaymentStatus.PENDING }),
    );
    expect(gateway.process).toHaveBeenCalledWith(25);
    expect(result).toMatchObject({
      status: PaymentStatus.APPROVED,
      transactionId: 'transaction-id',
      rejectionReason: null,
      processedAt: expect.any(Date),
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(metrics.recordPaymentApproved).toHaveBeenCalledTimes(1);
    expect(metrics.recordPaymentRejected).not.toHaveBeenCalled();
  });

  it('persists a business rejection as a successful result', async () => {
    repository.findOneBy.mockResolvedValue(null);
    gateway.process.mockResolvedValue({
      approved: false,
      rejectionReason: 'Limite excedido',
    });

    const result = await service.processPayment(message);

    expect(result).toMatchObject({
      status: PaymentStatus.REJECTED,
      transactionId: null,
      rejectionReason: 'Limite excedido',
      processedAt: expect.any(Date),
    });
    expect(metrics.recordPaymentRejected).toHaveBeenCalledWith(
      'Limite excedido',
    );
    expect(metrics.recordPaymentApproved).not.toHaveBeenCalled();
  });

  it('reuses a pending payment after a retry', async () => {
    const pending = {
      ...message,
      id: 'payment-id',
      status: PaymentStatus.PENDING,
      transactionId: null,
      rejectionReason: null,
      processedAt: null,
    } as Payment;
    repository.findOneBy.mockResolvedValue(pending);
    gateway.process.mockResolvedValue({
      approved: true,
      transactionId: 'transaction-id',
    });

    await service.processPayment(message);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(metrics.recordPaymentApproved).toHaveBeenCalledTimes(1);
  });

  it('returns an existing final payment without processing it again', async () => {
    const approved = {
      orderId: message.orderId,
      status: PaymentStatus.APPROVED,
    } as Payment;
    repository.findOneBy.mockResolvedValue(approved);

    await expect(service.processPayment(message)).resolves.toBe(approved);
    expect(gateway.process).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(metrics.recordPaymentApproved).not.toHaveBeenCalled();
    expect(metrics.recordPaymentRejected).not.toHaveBeenCalled();
  });

  it('propagates technical gateway failures', async () => {
    repository.findOneBy.mockResolvedValue(null);
    gateway.process.mockRejectedValue(new Error('gateway unavailable'));
    await expect(service.processPayment(message)).rejects.toThrow(
      'gateway unavailable',
    );
    expect(metrics.recordPaymentApproved).not.toHaveBeenCalled();
    expect(metrics.recordPaymentRejected).not.toHaveBeenCalled();
  });

  it('does not record metrics when terminal persistence fails', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.save
      .mockResolvedValueOnce({ status: PaymentStatus.PENDING } as Payment)
      .mockRejectedValueOnce(new Error('database unavailable'));
    gateway.process.mockResolvedValue({
      approved: true,
      transactionId: 'transaction-id',
    });

    await expect(service.processPayment(message)).rejects.toThrow(
      'database unavailable',
    );
    expect(metrics.recordPaymentApproved).not.toHaveBeenCalled();
    expect(metrics.recordPaymentRejected).not.toHaveBeenCalled();
  });

  it('finds a payment by order id or returns not found', async () => {
    const payment = { orderId: message.orderId } as Payment;
    repository.findOneBy.mockResolvedValueOnce(payment).mockResolvedValue(null);
    await expect(service.findByOrderId(message.orderId)).resolves.toBe(payment);
    await expect(service.findByOrderId(message.orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
