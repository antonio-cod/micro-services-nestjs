import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<Product> {
    if (request.user.role !== 'seller') {
      throw new ForbiddenException('Apenas vendedores podem criar produtos');
    }

    return this.productsService.create(createProductDto, request.user.id);
  }
}
