import { LoggingMiddleware } from './looging.middleware';

describe('LoogingMiddleware', () => {
  it('should be defined', () => {
    expect(new LoggingMiddleware()).toBeDefined();
  });
});
