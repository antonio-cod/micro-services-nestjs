import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  create(
    createProductDto: CreateProductDto,
    sellerId: string,
  ): Promise<Product> {
    const product = this.productsRepository.create({
      ...createProductDto,
      price: String(createProductDto.price),
      sellerId,
      isActive: true,
    });

    return this.productsRepository.save(product);
  }

  findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  findBySeller(sellerId: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { sellerId, isActive: true },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }
}
