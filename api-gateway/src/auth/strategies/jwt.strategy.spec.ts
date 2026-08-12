import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, ValidatedUser } from '../service/auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const payload = {
    sub: '91afac99-0cd9-4438-945e-2766594a725c',
    email: 'buyer@example.com',
    role: 'buyer',
  };
  let authService: { validateJwtToken: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    authService = { validateJwtToken: jest.fn() };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };
    strategy = new JwtStrategy(
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
    );
  });

  it('validates remotely using the unchanged Bearer header', async () => {
    const user: ValidatedUser = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    authService.validateJwtToken.mockResolvedValue(user);

    await expect(
      strategy.validate(
        { headers: { authorization: 'Bearer signed.jwt' } } as never,
        payload,
      ),
    ).resolves.toBe(user);
    expect(authService.validateJwtToken).toHaveBeenCalledWith(
      'Bearer signed.jwt',
    );
  });

  it('rejects missing credentials and mismatched remote claims', async () => {
    await expect(
      strategy.validate({ headers: {} } as never, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    authService.validateJwtToken.mockResolvedValue({
      userId: 'different-id',
      email: payload.email,
      role: payload.role,
    });
    await expect(
      strategy.validate(
        { headers: { authorization: 'Bearer signed.jwt' } } as never,
        payload,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
