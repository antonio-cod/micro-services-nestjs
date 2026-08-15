import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ProxyService } from '../proxy/service/proxy.service';
import { OrdersProxyController } from './orders-proxy.controller';

describe('OrdersProxyController', () => {
  let proxyService: { proxyRequest: jest.Mock };
  let controller: OrdersProxyController;
  let response: { status: jest.Mock; send: jest.Mock };

  const user = {
    userId: 'buyer-id',
    email: 'buyer@example.com',
    role: 'buyer',
  };
  const authorization = 'Bearer signed.jwt';

  beforeEach(() => {
    proxyService = { proxyRequest: jest.fn() };
    controller = new OrdersProxyController(
      proxyService as unknown as ProxyService,
    );
    response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('forwards checkout with its body and authorization', async () => {
    const body = { paymentMethod: 'pix' };
    const data = { id: 'order-id', paymentMethod: 'pix' };
    const request = createRequest('POST', '/cart/checkout');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 201 });

    await controller.checkout(body, request as never, response as never);

    expectForwarded('POST', '/cart/checkout', body);
    expectResponse(201, data);
  });

  it('forwards an orders query without a body', async () => {
    const data = [{ id: 'order-id' }];
    const request = createRequest('GET', '/orders');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 200 });

    await controller.findAll(request as never, response as never);

    expectForwarded('GET', '/orders', undefined);
    expectResponse(200, data);
  });

  it('forwards the order id in the query URL and preserves errors', async () => {
    const data = { message: 'Pedido não encontrado' };
    const request = createRequest('GET', '/orders/order-id');
    proxyService.proxyRequest.mockResolvedValue({ data, status: 404 });

    await controller.findOne(request as never, response as never);

    expectForwarded('GET', '/orders/order-id', undefined);
    expectResponse(404, data);
  });

  it('does not mark the controller or its routes as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OrdersProxyController),
    ).toBeUndefined();

    for (const method of ['checkout', 'findAll', 'findOne'] as const) {
      const handler = Object.getOwnPropertyDescriptor(
        OrdersProxyController.prototype,
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
