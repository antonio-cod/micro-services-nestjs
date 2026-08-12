import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule, createJwtOptions } from './auth.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  it('registers JwtAuthGuard as a global guard', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AuthModule,
    ) as Array<unknown>;

    expect(providers).toEqual(
      expect.arrayContaining([
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ]),
    );
  });
});
