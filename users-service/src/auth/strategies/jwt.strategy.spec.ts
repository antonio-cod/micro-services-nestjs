import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../users/enums/user-role.enum';
import { createJwtStrategyOptions, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    get: jest.fn().mockReturnValue('jwt-secret'),
  } as unknown as ConfigService;

  it('configures Bearer extraction, expiration validation, and the secret', () => {
    const options = createJwtStrategyOptions(configService);

    expect(options.ignoreExpiration).toBe(false);
    expect(options.secretOrKey).toBe('jwt-secret');
    expect(
      options.jwtFromRequest({
        headers: { authorization: 'Bearer signed.jwt.token' },
      }),
    ).toBe('signed.jwt.token');
    expect(
      options.jwtFromRequest({
        headers: { authorization: 'Basic credentials' },
      }),
    ).toBeNull();
  });

  it('maps only the authenticated user fields from the payload', () => {
    const strategy = new JwtStrategy(configService);

    expect(
      strategy.validate({
        sub: '91afac99-0cd9-4438-945e-2766594a725c',
        email: 'seller@example.com',
        role: UserRole.SELLER,
        iat: 1,
        exp: 2,
        password: 'must-not-leak',
      } as never),
    ).toEqual({
      id: '91afac99-0cd9-4438-945e-2766594a725c',
      email: 'seller@example.com',
      role: UserRole.SELLER,
    });
  });

  it.each([undefined, '', '   '])(
    'rejects a missing or empty secret (%p)',
    (secret) => {
      const invalidConfig = {
        get: jest.fn().mockReturnValue(secret),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(invalidConfig)).toThrow(
        'JWT_SECRET deve ser definida com um valor não vazio',
      );
    },
  );
});
