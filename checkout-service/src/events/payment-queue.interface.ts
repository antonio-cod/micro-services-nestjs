import type { PaymentMethod } from '../orders/entities/order.entity';

export interface PaymentOrderMessage {
  orderId: string;
  userId: string;
  amount: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: PaymentMethod;
  description?: string;
  createdAt?: Date;
  metadata?: {
    service: string;
    timestamp: string;
  };
}
