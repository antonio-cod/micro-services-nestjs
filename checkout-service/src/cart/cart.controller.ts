import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CartResponse } from './cart-response';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('items')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Item adicionado e carrinho atualizado' })
  addItem(
    @Body() input: AddCartItemDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartResponse> {
    return this.cartService.addItem(request.user.id, input);
  }

  @Get()
  @ApiOkResponse({ description: 'Carrinho ativo do usuário' })
  findActive(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartResponse> {
    return this.cartService.findActive(request.user.id);
  }

  @Delete('items/:itemId')
  @ApiOkResponse({ description: 'Item removido e carrinho atualizado' })
  removeItem(
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartResponse> {
    return this.cartService.removeItem(request.user.id, itemId);
  }
}
