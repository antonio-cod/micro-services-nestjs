import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the checkout service health status', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      service: 'checkout-service',
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
