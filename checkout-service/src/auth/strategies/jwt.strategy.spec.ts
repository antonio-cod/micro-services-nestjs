import { ConfigService } from '@nestjs/config';
import { createJwtStrategyOptions, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    get: jest.fn().mockReturnValue('shared-secret'),
  } as unknown as ConfigService;

  it('validates Bearer JWTs with expiration enabled', () => {
    const options = createJwtStrategyOptions(configService);

    expect(options.secretOrKey).toBe('shared-secret');
    expect(options.ignoreExpiration).toBe(false);
    expect(options.jwtFromRequest({ headers: {} })).toBeNull();
    expect(
      options.jwtFromRequest({
        headers: { authorization: 'Bearer token-value' },
      }),
    ).toBe('token-value');
  });

  it('maps only the public authenticated user fields', () => {
    const strategy = new JwtStrategy(configService);

    expect(
      strategy.validate({
        sub: '91afac99-0cd9-4438-945e-2766594a725c',
        email: 'buyer@example.com',
        role: 'buyer',
      }),
    ).toEqual({
      id: '91afac99-0cd9-4438-945e-2766594a725c',
      email: 'buyer@example.com',
      role: 'buyer',
    });
  });
});
