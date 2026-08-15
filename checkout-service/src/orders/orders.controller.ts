import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OrderResponse } from './order-response';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOkResponse({ type: OrderResponse, isArray: true })
  findAll(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<OrderResponse[]> {
    return this.ordersService.findAll(request.user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderResponse })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<OrderResponse> {
    return this.ordersService.findOne(request.user.id, id);
  }
}
