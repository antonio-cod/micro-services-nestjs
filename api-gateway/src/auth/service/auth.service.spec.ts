import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { serviceConfig } from '../../config/gateway.config';
import { AuthService, ValidatedUser } from './auth.service';

describe('AuthService token validation', () => {
  let httpService: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    httpService = { get: jest.fn() };
    service = new AuthService(httpService as unknown as HttpService);
  });

  it('forwards the original Authorization header', async () => {
    const authorization = 'Bearer signed.jwt.token';
    const user: ValidatedUser = {
      userId: '91afac99-0cd9-4438-945e-2766594a725c',
      email: 'buyer@example.com',
      role: 'buyer',
    };
    httpService.get.mockReturnValue(of({ data: user } as AxiosResponse));

    await expect(service.validateJwtToken(authorization)).resolves.toBe(user);
    expect(httpService.get).toHaveBeenCalledWith(
      `${serviceConfig.users.url}/auth/validate-token`,
      {
        headers: { Authorization: authorization },
        timeout: serviceConfig.users.timeout,
      },
    );
  });

  it.each([
    ['the users service rejects it', throwError(() => new Error('401'))],
    ['the users service returns an invalid body', of({ data: {} })],
  ])('returns Unauthorized when %s', async (_scenario, response) => {
    httpService.get.mockReturnValue(response);

    await expect(
      service.validateJwtToken('Bearer invalid'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
