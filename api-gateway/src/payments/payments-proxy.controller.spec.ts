import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ProxyService } from '../proxy/service/proxy.service';
import { PaymentsProxyController } from './payments-proxy.controller';

describe('PaymentsProxyController', () => {
  let proxyService: { proxyRequest: jest.Mock };
  let controller: PaymentsProxyController;
  let response: { status: jest.Mock; send: jest.Mock };

  const user = {
    userId: 'buyer-id',
    email: 'buyer@example.com',
    role: 'buyer',
  };
  const authorization = 'Bearer signed.jwt';

  beforeEach(() => {
    proxyService = { proxyRequest: jest.fn() };
    controller = new PaymentsProxyController(
      proxyService as unknown as ProxyService,
    );
    response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it.each([
    [200, { orderId: 'order-id', status: 'approved' }],
    [404, { message: 'Payment for order order-id not found' }],
  ])('preserves a %i response from payments-service', async (status, data) => {
    const request = {
      method: 'GET',
      originalUrl: '/payments/order-id',
      headers: { authorization },
      user,
    };
    proxyService.proxyRequest.mockResolvedValue({ data, status });

    await controller.findByOrderId(request as never, response as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'payments',
      'GET',
      '/payments/order-id',
      undefined,
      { Authorization: authorization },
      user,
    );
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.send).toHaveBeenCalledWith(data);
  });

  it('does not mark the controller or its route as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PaymentsProxyController),
    ).toBeUndefined();
    const handler = Object.getOwnPropertyDescriptor(
      PaymentsProxyController.prototype,
      'findByOrderId',
    )?.value as object;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });
});
