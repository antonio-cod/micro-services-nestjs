import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: {
    create: jest.Mock<Promise<Product>, [CreateProductDto, string]>;
  };
  const input = {
    name: 'Monitor',
    description: 'Monitor IPS',
    price: 999.99,
    stock: 2,
  };

  function requestFor(role: string) {
    return {
      user: {
        id: '91afac99-0cd9-4438-945e-2766594a725c',
        email: 'user@example.com',
        role,
      },
    } as Request & { user: AuthenticatedUser };
  }

  beforeEach(async () => {
    service = {
      create: jest.fn<Promise<Product>, [CreateProductDto, string]>(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get(ProductsController);
  });

  it('allows a seller and forwards only the authenticated seller id', async () => {
    const product = { id: 'product-id' } as Product;
    service.create.mockResolvedValue(product);

    await expect(controller.create(input, requestFor('seller'))).resolves.toBe(
      product,
    );
    expect(service.create).toHaveBeenCalledWith(
      input,
      '91afac99-0cd9-4438-945e-2766594a725c',
    );
  });

  it.each(['buyer', 'admin'])('rejects role %s without creating', (role) => {
    expect(() => controller.create(input, requestFor(role))).toThrow(
      ForbiddenException,
    );
    expect(service.create).not.toHaveBeenCalled();
  });
});
