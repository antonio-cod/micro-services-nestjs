import { LoogingMiddleware } from './looging.middleware';

describe('LoogingMiddleware', () => {
  it('should be defined', () => {
    expect(new LoogingMiddleware()).toBeDefined();
  });
});
