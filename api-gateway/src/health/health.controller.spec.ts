import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckService } from '../common/health/health-check.service';
import {
  HealthCheckService as TerminusHealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { serviceConfig } from '../config/gateway.config';

describe('HealthController', () => {
  let controller: HealthController;
  let terminusHealthCheckService: { check: jest.Mock };
  let httpHealthIndicator: { pingCheck: jest.Mock };

  beforeEach(async () => {
    terminusHealthCheckService = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        const results = await Promise.all(
          indicators.map((indicator) => indicator()),
        );
        const details = Object.assign({}, ...results);
        return { status: 'ok', info: details, error: {}, details };
      }),
    };
    httpHealthIndicator = {
      pingCheck: jest.fn(async (name: string) => ({
        [name]: { status: 'up' },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: {} },
        { provide: HealthCheckService, useValue: {} },
        {
          provide: TerminusHealthCheckService,
          useValue: terminusHealthCheckService,
        },
        { provide: HttpHealthIndicator, useValue: httpHealthIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('checks every configured downstream once with a 3 second timeout', async () => {
    await controller.getHealth();

    expect(terminusHealthCheckService.check).toHaveBeenCalledTimes(1);
    expect(httpHealthIndicator.pingCheck.mock.calls).toEqual([
      [
        'users-service',
        `${serviceConfig.users.url.replace(/\/+$/, '')}/health`,
        { timeout: 3_000 },
      ],
      [
        'products-service',
        `${serviceConfig.products.url.replace(/\/+$/, '')}/health`,
        { timeout: 3_000 },
      ],
      [
        'checkout-service',
        `${serviceConfig.checkout.url.replace(/\/+$/, '')}/health`,
        { timeout: 3_000 },
      ],
      [
        'payments-service',
        `${serviceConfig.payments.url.replace(/\/+$/, '')}/health`,
        { timeout: 3_000 },
      ],
    ]);
  });
});
