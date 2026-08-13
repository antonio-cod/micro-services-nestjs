import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ProxyService } from '../proxy/service/proxy.service';
import { ProductsController } from './products.controller';

describe('ProductsController', () => {
  let proxyService: { proxyRequest: jest.Mock };
  let controller: ProductsController;
  let response: { status: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    proxyService = { proxyRequest: jest.fn() };
    controller = new ProductsController(
      proxyService as unknown as ProxyService,
    );
    response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it.each([
    ['findAll', '/products?page=2'],
    ['findBySeller', '/products/seller/seller-id?active=true'],
    ['findOne', '/products/product-id'],
  ] as const)(
    'forwards public %s requests with their complete URL',
    async (handler, originalUrl) => {
      const data = [{ id: 'product-id' }];
      const request = {
        method: 'GET',
        originalUrl,
        headers: {},
      };
      proxyService.proxyRequest.mockResolvedValue({ data, status: 200 });

      await controller[handler](request as never, response as never);

      expect(proxyService.proxyRequest).toHaveBeenCalledWith(
        'products',
        'GET',
        originalUrl,
        undefined,
        undefined,
        undefined,
      );
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.send).toHaveBeenCalledWith(data);
    },
  );

  it('forwards the creation body, user and original Authorization header', async () => {
    const body = { name: 'Notebook', price: 5499.9, stock: 3 };
    const data = { id: 'product-id', ...body };
    const user = {
      userId: 'seller-id',
      email: 'seller@example.com',
      role: 'seller',
    };
    const request = {
      method: 'POST',
      originalUrl: '/products',
      headers: { authorization: 'Bearer signed.jwt' },
      user,
    };
    proxyService.proxyRequest.mockResolvedValue({ data, status: 201 });

    await controller.create(body, request as never, response as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'products',
      'POST',
      '/products',
      body,
      { Authorization: 'Bearer signed.jwt' },
      user,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.send).toHaveBeenCalledWith(data);
  });

  it.each([
    ['findAll', 'findAll'],
    ['findBySeller', 'findBySeller'],
    ['findOne', 'findOne'],
  ] as const)('marks %s as public', (_name, methodName) => {
    const handler = Object.getOwnPropertyDescriptor(
      ProductsController.prototype,
      methodName,
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('keeps product creation protected', () => {
    const handler = Object.getOwnPropertyDescriptor(
      ProductsController.prototype,
      'create',
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });

  it.each([
    [401, { message: 'Unauthorized' }],
    [403, { message: 'Forbidden' }],
    [404, { message: 'Produto não encontrado' }],
  ])(
    'preserves downstream status %s and response body',
    async (status, data) => {
      const request = {
        method: 'GET',
        originalUrl: '/products/missing',
        headers: {},
      };
      proxyService.proxyRequest.mockResolvedValue({ data, status });

      await controller.findOne(request as never, response as never);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.send).toHaveBeenCalledWith(data);
    },
  );
});
