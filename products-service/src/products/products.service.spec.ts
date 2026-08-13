import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

type RepositoryMock = Pick<Repository<Product>, 'create' | 'save'>;

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<RepositoryMock>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
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
});
