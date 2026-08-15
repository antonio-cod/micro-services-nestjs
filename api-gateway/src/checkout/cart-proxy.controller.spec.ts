import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ProxyService } from '../proxy/service/proxy.service';
import { CartProxyController } from './cart-proxy.controller';

describe('CartProxyController', () => {
  let proxyService: { proxyRequest: jest.Mock };
  let controller: CartProxyController;
  let response: { status: jest.Mock; send: jest.Mock };

  const user = {
    userId: 'buyer-id',
    email: 'buyer@example.com',
    role: 'buyer',
  };
  const authorization = 'Bearer signed.jwt';

  beforeEach(() => {
    proxyService = { proxyRequest: jest.fn() };
    controller = new CartProxyController(
      proxyService as unknown as ProxyService,
    );
    response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('forwards an item addition with its body and authorization', async () => {
    const body = { productId: 'product-id', quantity: 2 };
    const data = { id: 'cart-id', items: [body] };
    const request = createRequest('POST', '/cart/items');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 200 });

    await controller.addItem(body, request as never, response as never);

    expectForwarded('POST', '/cart/items', body);
    expectResponse(200, data);
  });

  it('forwards an active cart query without a body', async () => {
    const data = { id: 'cart-id', items: [] };
    const request = createRequest('GET', '/cart');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 200 });

    await controller.findActive(request as never, response as never);

    expectForwarded('GET', '/cart', undefined);
    expectResponse(200, data);
  });

  it('forwards itemId in the removal URL and preserves the response', async () => {
    const data = { id: 'cart-id', items: [] };
    const request = createRequest('DELETE', '/cart/items/item-id');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 202 });

    await controller.removeItem(request as never, response as never);

    expectForwarded('DELETE', '/cart/items/item-id', undefined);
    expectResponse(202, data);
  });

  it('does not mark the controller or its routes as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, CartProxyController),
    ).toBeUndefined();

    for (const method of ['addItem', 'findActive', 'removeItem'] as const) {
      const handler = Object.getOwnPropertyDescriptor(
        CartProxyController.prototype,
        method,
      )?.value as object;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
  });

  function createRequest(method: string, originalUrl: string) {
    return {
      method,
      originalUrl,
      headers: { authorization },
      user,
    };
  }

  function expectForwarded(method: string, path: string, body: unknown) {
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkout',
      method,
      path,
      body,
      { Authorization: authorization },
      user,
    );
  }

  function expectResponse(status: number, data: unknown) {
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.send).toHaveBeenCalledWith(data);
  }
});
