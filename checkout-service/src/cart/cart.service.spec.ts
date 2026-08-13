/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { ProductsClientService } from '../products-client/products-client.service';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import { Cart, CartStatus } from './entities/cart.entity';

const userId = '91afac99-0cd9-4438-945e-2766594a725c';
const productId = 'f18d3b2f-fc2d-4867-b62f-708497172963';

describe('CartService', () => {
  const productsClient = {
    getProduct: jest.fn(),
  } as unknown as ProductsClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(productsClient, 'getProduct').mockResolvedValue({
      id: productId,
      name: 'Current catalog name',
      price: 10.1,
      stock: 0,
      isActive: true,
      sellerId: '2361e562-912a-4f8a-9644-96be6d46d4d5',
    });
  });

  it('returns an empty active cart without persisting it', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({ findOne }),
    } as unknown as DataSource;

    await expect(
      new CartService(dataSource, productsClient).findActive(userId),
    ).resolves.toEqual({
      id: null,
      userId,
      status: CartStatus.ACTIVE,
      total: 0,
      items: [],
      createdAt: null,
      updatedAt: null,
    });
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(productsClient.getProduct).not.toHaveBeenCalled();
  });

  it('creates the first item using integer-cent arithmetic', async () => {
    const savedCart = cartWithItems([]);
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(savedCart),
      save: jest.fn().mockImplementation((cart: Cart) => Promise.resolve(cart)),
      findOneBy: jest.fn().mockResolvedValue(savedCart),
    } as unknown as Repository<Cart>;
    const itemRepository = {
      create: jest.fn((item: CartItem) => item),
      findBy: jest.fn().mockResolvedValue([]),
      save: jest.fn((item: CartItem) => {
        item.id = 'c9068589-7916-4209-8610-ae4376d66403';
        item.createdAt = new Date('2026-08-13T00:00:00.000Z');
        return Promise.resolve(item);
      }),
    } as unknown as Repository<CartItem>;
    const service = serviceWithTransaction(cartRepository, itemRepository);

    const response = await service.addItem(userId, { productId, quantity: 3 });

    expect(response.total).toBe(30.3);
    expect(response.items[0]).toMatchObject({
      productId,
      productName: 'Current catalog name',
      price: 10.1,
      quantity: 3,
      subtotal: 30.3,
    });
  });

  it('increments an existing item while preserving its snapshot', async () => {
    const existingItem = Object.assign(new CartItem(), {
      id: 'c9068589-7916-4209-8610-ae4376d66403',
      cartId: 'bb4f8ed8-c46e-41dc-a052-9f40c1b1672c',
      productId,
      productName: 'Original snapshot',
      price: 9.99,
      quantity: 1,
      subtotal: 9.99,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
    });
    const cart = cartWithItems([existingItem]);
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(cart),
      save: jest
        .fn()
        .mockImplementation((value: Cart) => Promise.resolve(value)),
      findOneBy: jest.fn().mockResolvedValue(cart),
    } as unknown as Repository<Cart>;
    const itemRepository = {
      findBy: jest.fn().mockResolvedValue([existingItem]),
      save: jest
        .fn()
        .mockImplementation((value: CartItem) => Promise.resolve(value)),
    } as unknown as Repository<CartItem>;
    const service = serviceWithTransaction(cartRepository, itemRepository);

    const response = await service.addItem(userId, { productId, quantity: 2 });

    expect(response.total).toBe(29.97);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      productName: 'Original snapshot',
      price: 9.99,
      quantity: 3,
      subtotal: 29.97,
    });
  });

  it('returns the same not-found error when no active cart owns the item', async () => {
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<Cart>;
    const itemRepository = {} as Repository<CartItem>;
    const service = serviceWithTransaction(cartRepository, itemRepository);

    await expect(service.removeItem(userId, productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes the last item and keeps an active cart with total zero', async () => {
    const item = Object.assign(new CartItem(), {
      id: 'c9068589-7916-4209-8610-ae4376d66403',
      cartId: 'bb4f8ed8-c46e-41dc-a052-9f40c1b1672c',
      productId,
      productName: 'Snapshot',
      price: 10,
      quantity: 1,
      subtotal: 10,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
    });
    const cart = cartWithItems([item]);
    cart.total = 10;
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(cart),
      save: jest
        .fn()
        .mockImplementation((value: Cart) => Promise.resolve(value)),
      findOneBy: jest.fn().mockImplementation(() => Promise.resolve(cart)),
    } as unknown as Repository<Cart>;
    const itemRepository = {
      findBy: jest.fn().mockResolvedValue([item]),
      remove: jest.fn().mockImplementation((value: CartItem) => {
        value.id = undefined as unknown as string;
        return Promise.resolve(value);
      }),
    } as unknown as Repository<CartItem>;
    const service = serviceWithTransaction(cartRepository, itemRepository);

    const response = await service.removeItem(
      userId,
      'c9068589-7916-4209-8610-ae4376d66403',
    );

    expect(response).toMatchObject({
      status: CartStatus.ACTIVE,
      total: 0,
      items: [],
    });
  });

  it('retries unique conflicts three times and then returns conflict', async () => {
    const uniqueError = new QueryFailedError('INSERT', [], { code: '23505' });
    const dataSource = {
      transaction: jest.fn().mockRejectedValue(uniqueError),
    } as unknown as DataSource;
    const service = new CartService(dataSource, productsClient);

    await expect(
      service.addItem(userId, { productId, quantity: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalledTimes(3);
    expect(productsClient.getProduct).toHaveBeenCalledTimes(1);
  });

  function serviceWithTransaction(
    cartRepository: Repository<Cart>,
    itemRepository: Repository<CartItem>,
  ): CartService {
    const manager = {
      getRepository: jest.fn((entity: object) =>
        entity === Cart ? cartRepository : itemRepository,
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    return new CartService(dataSource, productsClient);
  }

  function cartWithItems(items: CartItem[]): Cart {
    return Object.assign(new Cart(), {
      id: 'bb4f8ed8-c46e-41dc-a052-9f40c1b1672c',
      userId,
      status: CartStatus.ACTIVE,
      total: 0,
      items,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
    });
  }
});
