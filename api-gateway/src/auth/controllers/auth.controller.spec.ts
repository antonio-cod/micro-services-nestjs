import { ProxyService } from '../../proxy/service/proxy.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let proxyService: { proxyRequest: jest.Mock };
  let controller: AuthController;
  let response: { status: jest.Mock };

  beforeEach(() => {
    proxyService = { proxyRequest: jest.fn() };
    controller = new AuthController(proxyService as unknown as ProxyService);
    response = { status: jest.fn() };
  });

  it.each([
    ['login', '/auth/login', 200],
    ['register', '/auth/register', 201],
  ] as const)(
    'proxies %s and preserves its status',
    async (method, path, status) => {
      const body = { email: 'buyer@example.com', password: 'secret123' };
      const data = { ok: true };
      proxyService.proxyRequest.mockResolvedValue({ data, status });

      await expect(
        controller[method](body as never, response as never),
      ).resolves.toBe(data);
      expect(proxyService.proxyRequest).toHaveBeenCalledWith(
        'users',
        'POST',
        path,
        body,
      );
      expect(response.status).toHaveBeenCalledWith(status);
    },
  );
});
