import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart, CartStatus } from '../cart/entities/cart.entity';
import { PaymentQueueService } from '../events/payment-queue/payment-queue.service';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrdersService } from './orders.service';

const userId = '91afac99-0cd9-4438-945e-2766594a725c';
const cartId = '9bf702fe-dbb4-42af-bc42-956681ed1385';
const orderId = '04358217-51aa-4c70-b40e-2294db6272ae';
const productId = 'f18d3b2f-fc2d-4867-b62f-708497172963';

describe('OrdersService', () => {
  const cart: Cart = {
    id: cartId,
    userId,
    status: CartStatus.ACTIVE,
    total: 25.5,
    items: [],
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
    updatedAt: new Date('2026-08-15T10:00:00.000Z'),
  };
  const item: CartItem = {
    id: 'ad13a2ab-4e70-45a3-b94d-677df9ff8442',
    cart,
    cartId,
    productId,
    productName: 'Product',
    price: 12.75,
    quantity: 2,
    subtotal: 25.5,
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
  };
  const order: Order = {
    id: orderId,
    userId,
    cartId,
    total: 25.5,
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.PIX,
    createdAt: new Date('2026-08-15T10:05:00.000Z'),
    updatedAt: new Date('2026-08-15T10:05:00.000Z'),
  };

  let service: OrdersService;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let paymentQueueService: { publishPaymentOrder: jest.Mock };
  let cartRepository: { findOne: jest.Mock; save: jest.Mock };
  let itemRepository: { findBy: jest.Mock };
  let orderRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let manager: { getRepository: jest.Mock };

  beforeEach(() => {
    cartRepository = {
      findOne: jest.fn().mockResolvedValue({ ...cart }),
      save: jest.fn().mockImplementation((value: Cart) => value),
    };
    itemRepository = { findBy: jest.fn().mockResolvedValue([{ ...item }]) };
    orderRepository = {
      create: jest.fn().mockImplementation((value: Partial<Order>) => value),
      save: jest.fn().mockResolvedValue({ ...order }),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    manager = {
      getRepository: jest.fn(
        (entity: typeof Cart | typeof CartItem | typeof Order) => {
          if (entity === Cart) return cartRepository;
          if (entity === CartItem) return itemRepository;
          return orderRepository;
        },
      ),
    };
    dataSource = {
      transaction: jest.fn(
        (callback: (entityManager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
      getRepository: jest.fn().mockReturnValue(orderRepository),
    };
    paymentQueueService = {
      publishPaymentOrder: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrdersService(
      dataSource as unknown as DataSource,
      paymentQueueService as unknown as PaymentQueueService,
    );
  });

  it.each(Object.values(PaymentMethod))(
    'completes checkout using %s and publishes the payment message',
    async (paymentMethod: PaymentMethod) => {
      orderRepository.save.mockResolvedValue({
        ...order,
        paymentMethod,
      });

      const result = await service.checkout(userId, { paymentMethod });

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId,
        cartId,
        total: 25.5,
        status: OrderStatus.PENDING,
        paymentMethod,
      });
      expect(cartRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CartStatus.COMPLETED }),
      );
      expect(paymentQueueService.publishPaymentOrder).toHaveBeenCalledTimes(1);
      expect(paymentQueueService.publishPaymentOrder).toHaveBeenCalledWith({
        orderId,
        userId,
        amount: 25.5,
        items: [{ productId, quantity: 2, price: 12.75 }],
        paymentMethod,
        createdAt: order.createdAt,
      });
      expect(result).toMatchObject({ id: orderId, status: 'pending' });
    },
  );

  it('rejects checkout when no active cart exists', async () => {
    cartRepository.findOne.mockResolvedValue(null);

    await expect(
      service.checkout(userId, { paymentMethod: PaymentMethod.PIX }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(paymentQueueService.publishPaymentOrder).not.toHaveBeenCalled();
  });

  it.each([
    [[], 25.5],
    [[item], 0],
    [[item], Number.NaN],
  ])('rejects an empty cart or invalid total', async (items, total) => {
    cartRepository.findOne.mockResolvedValue({ ...cart, total });
    itemRepository.findBy.mockResolvedValue(items);

    await expect(
      service.checkout(userId, { paymentMethod: PaymentMethod.BOLETO }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('returns 503 after persistence when payment publication fails', async () => {
    paymentQueueService.publishPaymentOrder.mockRejectedValue(
      new Error('RabbitMQ unavailable'),
    );

    await expect(
      service.checkout(userId, { paymentMethod: PaymentMethod.CREDIT_CARD }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
    expect(cartRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: CartStatus.COMPLETED }),
    );
  });

  it('lets transaction failures roll back without publishing', async () => {
    orderRepository.save.mockRejectedValue(new Error('database failure'));

    await expect(
      service.checkout(userId, { paymentMethod: PaymentMethod.DEBIT_CARD }),
    ).rejects.toThrow('database failure');
    expect(paymentQueueService.publishPaymentOrder).not.toHaveBeenCalled();
  });

  it('lists only user orders in descending creation order', async () => {
    orderRepository.find.mockResolvedValue([order]);

    await expect(service.findAll(userId)).resolves.toEqual([
      expect.objectContaining({ id: orderId, total: 25.5 }),
    ]);
    expect(dataSource.getRepository).toHaveBeenCalledWith(Order);
    expect(orderRepository.find).toHaveBeenCalledWith({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  });

  it('finds an order by both id and authenticated user', async () => {
    orderRepository.findOne.mockResolvedValue(order);

    await expect(service.findOne(userId, orderId)).resolves.toMatchObject({
      id: orderId,
    });
    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: orderId, userId },
    });
  });

  it('uses the same not-found response for missing or foreign orders', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(userId, orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
