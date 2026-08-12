import { ProxyService } from '../proxy/service/proxy.service';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('forwards the complete URL and original Authorization header', async () => {
    const proxyService = {
      proxyRequest: jest.fn().mockResolvedValue({
        data: [{ id: 'seller-id' }],
        status: 200,
      }),
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnValue([{ id: 'seller-id' }]),
    };
    const request = {
      method: 'GET',
      originalUrl: '/users/sellers?page=2',
      headers: { authorization: 'Bearer signed.jwt' },
      user: { userId: 'user-id', email: 'user@example.com', role: 'buyer' },
    };
    const controller = new UsersController(
      proxyService as unknown as ProxyService,
    );

    await controller.sellers(request as never, response as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'users',
      'GET',
      '/users/sellers?page=2',
      undefined,
      { Authorization: 'Bearer signed.jwt' },
      request.user,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([{ id: 'seller-id' }]);
  });
});
