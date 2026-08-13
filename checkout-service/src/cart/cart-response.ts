import { Cart, CartStatus } from './entities/cart.entity';

export interface CartItemResponse {
  id: string;
  cartId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  createdAt: Date;
}

export interface CartResponse {
  id: string | null;
  userId: string;
  status: CartStatus;
  total: number;
  items: CartItemResponse[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function toCartResponse(cart: Cart): CartResponse {
  return {
    id: cart.id,
    userId: cart.userId,
    status: cart.status,
    total: Number(cart.total),
    items: cart.items.map((item) => ({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      productName: item.productName,
      price: Number(item.price),
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
      createdAt: item.createdAt,
    })),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

export function emptyCartResponse(userId: string): CartResponse {
  return {
    id: null,
    userId,
    status: CartStatus.ACTIVE,
    total: 0,
    items: [],
    createdAt: null,
    updatedAt: null,
  };
}
