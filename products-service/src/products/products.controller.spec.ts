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
    findAll: jest.Mock<Promise<Product[]>, []>;
    findBySeller: jest.Mock<Promise<Product[]>, [string]>;
    findOne: jest.Mock<Promise<Product>, [string]>;
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
      findAll: jest.fn<Promise<Product[]>, []>(),
      findBySeller: jest.fn<Promise<Product[]>, [string]>(),
      findOne: jest.fn<Promise<Product>, [string]>(),
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

  it('returns the active product catalog from the service', async () => {
    const products = [{ id: 'product-id' }] as Product[];
    service.findAll.mockResolvedValue(products);

    await expect(controller.findAll()).resolves.toBe(products);
    expect(service.findAll).toHaveBeenCalledWith();
  });

  it('forwards the seller id and returns their active products', async () => {
    const sellerId = '91afac99-0cd9-4438-945e-2766594a725c';
    const products = [{ sellerId }] as Product[];
    service.findBySeller.mockResolvedValue(products);

    await expect(controller.findBySeller(sellerId)).resolves.toBe(products);
    expect(service.findBySeller).toHaveBeenCalledWith(sellerId);
  });

  it('forwards the product id and returns the product', async () => {
    const product = {
      id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
    } as Product;
    service.findOne.mockResolvedValue(product);

    await expect(controller.findOne(product.id)).resolves.toBe(product);
    expect(service.findOne).toHaveBeenCalledWith(product.id);
  });
});
