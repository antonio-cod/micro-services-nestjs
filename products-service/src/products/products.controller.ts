import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Public()
  @Get('seller/:sellerId')
  findBySeller(@Param('sellerId') sellerId: string): Promise<Product[]> {
    return this.productsService.findBySeller(sellerId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
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
