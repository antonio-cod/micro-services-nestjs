import type { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns registry output with its Prometheus content type', async () => {
    const metricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP test metric'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
    };
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );

    await expect(controller.getMetrics(response)).resolves.toBe(
      '# HELP test metric',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4',
    );
  });
});
