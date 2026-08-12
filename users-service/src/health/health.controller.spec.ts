import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('is public and reports the users service as available', () => {
    const controller = new HealthController();
    const handler = Object.getOwnPropertyDescriptor(
      HealthController.prototype,
      'check',
    )?.value as unknown;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'users-service',
    });
  });
});
