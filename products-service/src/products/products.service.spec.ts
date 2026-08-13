import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

type RepositoryMock = Pick<
  Repository<Product>,
  'create' | 'save' | 'find' | 'findOneBy'
>;

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<RepositoryMock>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repository },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('persists and returns a product associated with the authenticated seller', async () => {
    const input = {
      name: 'Mouse',
      description: 'Mouse sem fio',
      price: 89.9,
      stock: 4,
    };
    const sellerId = '91afac99-0cd9-4438-945e-2766594a725c';
    const created = {
      ...input,
      price: '89.9',
      sellerId,
      isActive: true,
    } as Product;
    const saved = {
      ...created,
      id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
      createdAt: new Date('2026-08-13T12:00:00.000Z'),
      updatedAt: new Date('2026-08-13T12:00:00.000Z'),
    };
    repository.create.mockReturnValue(created);
    repository.save.mockResolvedValue(saved);

    await expect(service.create(input, sellerId)).resolves.toBe(saved);
    expect(repository.create).toHaveBeenCalledWith({
      ...input,
      price: '89.9',
      sellerId,
      isActive: true,
    });
    expect(repository.save).toHaveBeenCalledWith(created);
  });

  it('returns active products ordered by newest first', async () => {
    const products = [
      {
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        createdAt: new Date('2026-08-13T13:00:00.000Z'),
        isActive: true,
      },
      {
        id: 'c04045f0-04f3-4a22-91cc-76ff61341a47',
        createdAt: new Date('2026-08-13T12:00:00.000Z'),
        isActive: true,
      },
    ] as Product[];
    repository.find.mockResolvedValue(products);

    await expect(service.findAll()).resolves.toBe(products);
    expect(repository.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('returns an empty active product list without error', async () => {
    repository.find.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('returns only active products for the requested seller', async () => {
    const sellerId = '91afac99-0cd9-4438-945e-2766594a725c';
    const products = [{ sellerId, isActive: true }] as Product[];
    repository.find.mockResolvedValue(products);

    await expect(service.findBySeller(sellerId)).resolves.toBe(products);
    expect(repository.find).toHaveBeenCalledWith({
      where: { sellerId, isActive: true },
    });
  });

  it('returns an empty seller product list without error', async () => {
    repository.find.mockResolvedValue([]);

    await expect(
      service.findBySeller('91afac99-0cd9-4438-945e-2766594a725c'),
    ).resolves.toEqual([]);
  });

  it.each([true, false])(
    'returns an existing product by id when isActive is %s',
    async (isActive) => {
      const product = {
        id: '1381eeaf-0171-44e3-b03a-86359448b2b9',
        isActive,
      } as Product;
      repository.findOneBy.mockResolvedValue(product);

      await expect(service.findOne(product.id)).resolves.toBe(product);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: product.id });
    },
  );

  it('throws NotFoundException when the product does not exist', async () => {
    const productId = '1381eeaf-0171-44e3-b03a-86359448b2b9';
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(productId)).rejects.toThrow(
      new NotFoundException('Produto não encontrado'),
    );
  });
});
