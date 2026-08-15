import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderResponse } from './order-response';
import { OrdersService } from './orders.service';

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiCreatedResponse({
    description: 'Pedido criado e encaminhado para pagamento',
    type: OrderResponse,
  })
  checkout(
    @Body() input: CheckoutDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<OrderResponse> {
    return this.ordersService.checkout(request.user.id, input);
  }
}
