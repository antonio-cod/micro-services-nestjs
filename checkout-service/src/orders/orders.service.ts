import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart, CartStatus } from '../cart/entities/cart.entity';
import { toCents } from '../cart/money';
import { PaymentQueueService } from '../events/payment-queue/payment-queue.service';
import type { PaymentOrderMessage } from '../events/payment-queue.interface';
import { CheckoutDto } from './dto/checkout.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderResponse, toOrderResponse } from './order-response';

interface CompletedCheckout {
  order: Order;
  items: CartItem[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentQueueService: PaymentQueueService,
  ) {}

  async checkout(userId: string, input: CheckoutDto): Promise<OrderResponse> {
    const completedCheckout: CompletedCheckout =
      await this.dataSource.transaction(
        (manager: EntityManager): Promise<CompletedCheckout> =>
          this.completeCheckout(manager, userId, input),
      );

    const message: PaymentOrderMessage =
      this.createPaymentMessage(completedCheckout);

    try {
      await this.paymentQueueService.publishPaymentOrder(message);
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        'Não foi possível encaminhar o pedido para pagamento',
        { cause: error },
      );
    }

    return toOrderResponse(completedCheckout.order);
  }

  async findAll(userId: string): Promise<OrderResponse[]> {
    const orders: Order[] = await this.dataSource.getRepository(Order).find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return orders.map(toOrderResponse);
  }

  async findOne(userId: string, orderId: string): Promise<OrderResponse> {
    const order: Order | null = await this.dataSource
      .getRepository(Order)
      .findOne({
        where: { id: orderId, userId },
      });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return toOrderResponse(order);
  }

  private async completeCheckout(
    manager: EntityManager,
    userId: string,
    input: CheckoutDto,
  ): Promise<CompletedCheckout> {
    const cartRepository: Repository<Cart> = manager.getRepository(Cart);
    const cart: Cart | null = await cartRepository.findOne({
      where: { userId, status: CartStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });

    if (!cart) {
      throw new UnprocessableEntityException('Carrinho ativo não encontrado');
    }

    const items: CartItem[] = await manager.getRepository(CartItem).findBy({
      cartId: cart.id,
    });
    this.validateCart(cart, items);

    const orderRepository: Repository<Order> = manager.getRepository(Order);
    const order: Order = orderRepository.create({
      userId,
      cartId: cart.id,
      total: Number(cart.total),
      status: OrderStatus.PENDING,
      paymentMethod: input.paymentMethod,
    });
    const savedOrder: Order = await orderRepository.save(order);

    cart.status = CartStatus.COMPLETED;
    await cartRepository.save(cart);

    return { order: savedOrder, items };
  }

  private validateCart(cart: Cart, items: CartItem[]): void {
    if (items.length === 0) {
      throw new UnprocessableEntityException('Carrinho vazio');
    }

    try {
      if (toCents(cart.total) <= 0) {
        throw new Error('Non-positive total');
      }
    } catch {
      throw new UnprocessableEntityException('Total do carrinho inválido');
    }
  }

  private createPaymentMessage(
    completedCheckout: CompletedCheckout,
  ): PaymentOrderMessage {
    const { order, items }: CompletedCheckout = completedCheckout;
    return {
      orderId: order.id,
      userId: order.userId,
      amount: Number(order.total),
      items: items.map(
        (item: CartItem): PaymentOrderMessage['items'][number] => ({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.price),
        }),
      ),
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    };
  }
}
