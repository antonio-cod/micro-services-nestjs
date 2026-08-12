import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('should be defined', () => {
    expect(new JwtAuthGuard(new Reflector())).toBeDefined();
  });
});
