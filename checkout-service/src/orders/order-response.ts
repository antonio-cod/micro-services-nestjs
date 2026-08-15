import { ApiProperty } from '@nestjs/swagger';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';

export class OrderResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  cartId: string;

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  paymentMethod: PaymentMethod;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    userId: order.userId,
    cartId: order.cartId,
    total: Number(order.total),
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
