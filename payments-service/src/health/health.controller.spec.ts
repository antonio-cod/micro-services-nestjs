import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the service as healthy', () => {
    expect(new HealthController().check()).toEqual({ status: 'healthy' });
  });
});
