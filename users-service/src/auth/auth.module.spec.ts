import { ConfigService } from '@nestjs/config';
import { createJwtOptions } from './auth.module';

describe('AuthModule JWT configuration', () => {
  it('uses the configured secret and a 24-hour expiration', () => {
    const configService = {
      get: jest.fn().mockReturnValue('jwt-secret'),
    } as unknown as ConfigService;

    expect(createJwtOptions(configService)).toEqual({
      secret: 'jwt-secret',
      signOptions: { expiresIn: '24h' },
    });
  });

  it.each([undefined, '', '   '])(
    'rejects a missing or empty secret (%p)',
    (secret) => {
      const configService = {
        get: jest.fn().mockReturnValue(secret),
      } as unknown as ConfigService;

      expect(() => createJwtOptions(configService)).toThrow(
        'JWT_SECRET deve ser definida com um valor não vazio',
      );
    },
  );
});
