import { PATH_METADATA } from '@nestjs/common/constants';
import { PaymentConsumerService } from '../payment-consumer/payment-consumer.service';
import { ConsumerMetricsController } from './consumer-metrics.controller';

describe('ConsumerMetricsController', () => {
  const startedAt = new Date('2026-08-18T12:00:00.000Z');
  const metrics = {
    totalProcessed: 10,
    totalSuccess: 9,
    totalFailed: 1,
    totalRetries: 2,
    averageProcessingTime: 25,
    lastProcessedAt: new Date('2026-08-18T12:04:00.000Z'),
    startedAt,
  };
  const paymentConsumerService = {
    getMetrics: jest.fn(() => ({ ...metrics })),
    resetMetrics: jest.fn(),
  };
  const controller = new ConsumerMetricsController(
    paymentConsumerService as unknown as PaymentConsumerService,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-18T12:05:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it('uses the consumer-metrics route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ConsumerMetricsController)).toBe(
      'consumer-metrics',
    );
  });

  it('preserves the detailed metrics response', () => {
    expect(controller.getMetrics()).toEqual({
      ...metrics,
      successRate: '90.00%',
      uptime: '5m 0s',
      status: 'active',
    });
  });

  it('preserves the health response', () => {
    expect(controller.getHealth()).toEqual({
      status: 'healthy',
      checks: {
        isProcessing: true,
        hasGoodSuccessRate: true,
        hasLowFailures: true,
      },
      message: 'Consumer is operating normally',
      timestamp: '2026-08-18T12:05:00.000Z',
    });
  });

  it('preserves the summary response', () => {
    expect(controller.getSummary()).toEqual({
      processed: 10,
      success: 9,
      failed: 1,
      rate: '90.0%',
      avgTime: '25ms',
    });
  });

  it('resets the consumer metrics and preserves the response', () => {
    expect(controller.resetMetrics()).toEqual({
      success: true,
      message: 'Metrics reset successfully',
    });
    expect(paymentConsumerService.resetMetrics).toHaveBeenCalledTimes(1);
  });
});
