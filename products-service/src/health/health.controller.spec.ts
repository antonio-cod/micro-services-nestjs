import { HealthController } from './health.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('HealthController', () => {
  it('returns the products service health status', () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'products-service',
    });
  });

  it('is publicly accessible', () => {
    const handler = Object.getOwnPropertyDescriptor(
      HealthController.prototype,
      'check',
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });
});
