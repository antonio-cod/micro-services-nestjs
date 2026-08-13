/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError, AxiosHeaders, HttpStatusCode } from 'axios';
import { of, throwError } from 'rxjs';
import { ProductsClientService } from './products-client.service';

const productId = '91afac99-0cd9-4438-945e-2766594a725c';
const sellerId = 'f18d3b2f-fc2d-4867-b62f-708497172963';

describe('ProductsClientService', () => {
  const httpService = { get: jest.fn() } as unknown as HttpService;

  function createService(url: string | undefined = 'http://products:3001/') {
    const configService = {
      get: jest.fn().mockReturnValue(url),
    } as unknown as ConfigService;
    return new ProductsClientService(httpService, configService);
  }

  beforeEach(() => jest.clearAllMocks());

  it('normalizes the URL and a decimal product price', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: {
          id: productId,
          name: ' Product ',
          price: '19.90',
          stock: 0,
          isActive: true,
          sellerId,
        },
      } as never),
    );

    await expect(createService().getProduct(productId)).resolves.toEqual({
      id: productId,
      name: 'Product',
      price: 19.9,
      stock: 0,
      isActive: true,
      sellerId,
    });
    expect(httpService.get).toHaveBeenCalledWith(
      `http://products:3001/products/${productId}`,
    );
  });

  it.each([undefined, '', '   '])('rejects invalid base URL %p', (url) => {
    const configService = {
      get: jest.fn().mockReturnValue(url),
    } as unknown as ConfigService;
    expect(() => new ProductsClientService(httpService, configService)).toThrow(
      'PRODUCTS_SERVICE_URL deve ser definida com um valor não vazio',
    );
  });

  it('maps catalog 404 to product not found', async () => {
    const error = new AxiosError(
      'not found',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: {},
        status: HttpStatusCode.NotFound,
        statusText: 'Not Found',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      },
    );
    jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => error));

    await expect(createService().getProduct(productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps network errors to service unavailable', async () => {
    jest
      .spyOn(httpService, 'get')
      .mockReturnValue(throwError(() => new AxiosError('network')));

    await expect(createService().getProduct(productId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an invalid catalog response', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: {
          id: productId,
          name: '',
          price: '-1',
          stock: 0,
          isActive: true,
          sellerId,
        },
      } as never),
    );

    await expect(createService().getProduct(productId)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
