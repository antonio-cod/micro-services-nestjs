import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ProductsClientService } from '../products-client/products-client.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItem } from './entities/cart-item.entity';
import { Cart, CartStatus } from './entities/cart.entity';
import {
  CartResponse,
  emptyCartResponse,
  toCartResponse,
} from './cart-response';
import { fromCents, toCents } from './money';

const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class CartService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productsClient: ProductsClientService,
  ) {}

  async addItem(userId: string, input: AddCartItemDto): Promise<CartResponse> {
    const product = await this.productsClient.getProduct(input.productId);
    if (!product.isActive) {
      throw new UnprocessableEntityException('Produto inativo');
    }

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const cart = await this.dataSource.transaction((manager) =>
          this.addItemInTransaction(manager, userId, input, product),
        );
        return toCartResponse(cart);
      } catch (error: unknown) {
        if (!this.isUniqueViolation(error)) throw error;
        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new ConflictException(
            'Não foi possível atualizar o carrinho devido a operações concorrentes',
          );
        }
      }
    }

    throw new ConflictException('Não foi possível atualizar o carrinho');
  }

  async findActive(userId: string): Promise<CartResponse> {
    const cart = await this.dataSource.getRepository(Cart).findOne({
      where: { userId, status: CartStatus.ACTIVE },
    });
    return cart ? toCartResponse(cart) : emptyCartResponse(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const cart = await this.dataSource.transaction(async (manager) => {
      const activeCart = await this.findAndLockActiveCart(manager, userId);
      if (!activeCart) throw new NotFoundException('Item não encontrado');

      const item = activeCart.items.find(
        (candidate) => candidate.id === itemId,
      );
      if (!item) throw new NotFoundException('Item não encontrado');

      activeCart.items = activeCart.items.filter(
        (candidate) => candidate.id !== itemId,
      );
      await manager.getRepository(CartItem).remove(item);
      activeCart.total = this.calculateTotal(activeCart.items);
      await manager.getRepository(Cart).save(activeCart);
      return this.reloadCart(manager, activeCart.id);
    });

    return toCartResponse(cart);
  }

  private async addItemInTransaction(
    manager: EntityManager,
    userId: string,
    input: AddCartItemDto,
    product: {
      id: string;
      name: string;
      price: number;
    },
  ): Promise<Cart> {
    const cartRepository = manager.getRepository(Cart);
    const itemRepository = manager.getRepository(CartItem);
    let cart = await this.findAndLockActiveCart(manager, userId);

    if (!cart) {
      cart = cartRepository.create({
        userId,
        status: CartStatus.ACTIVE,
        total: 0,
        items: [],
      });
      cart = await cartRepository.save(cart);
      cart.items = [];
    }

    const existingItem = cart.items.find(
      (item) => item.productId === input.productId,
    );
    if (existingItem) {
      existingItem.quantity += input.quantity;
      existingItem.subtotal = this.multiplyMoney(
        existingItem.price,
        existingItem.quantity,
      );
      await itemRepository.save(existingItem);
    } else {
      const item = itemRepository.create({
        cartId: cart.id,
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: input.quantity,
        subtotal: this.multiplyMoney(product.price, input.quantity),
      });
      const savedItem = await itemRepository.save(item);
      cart.items.push(savedItem);
    }

    cart.total = this.calculateTotal(cart.items);
    await cartRepository.save(cart);
    return this.reloadCart(manager, cart.id);
  }

  private async findAndLockActiveCart(
    manager: EntityManager,
    userId: string,
  ): Promise<Cart | null> {
    const cart = await manager.getRepository(Cart).findOne({
      where: { userId, status: CartStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    if (cart) {
      cart.items = await manager.getRepository(CartItem).findBy({
        cartId: cart.id,
      });
    }
    return cart;
  }

  private async reloadCart(
    manager: EntityManager,
    cartId: string,
  ): Promise<Cart> {
    const cart = await manager.getRepository(Cart).findOneBy({ id: cartId });
    if (!cart) throw new NotFoundException('Carrinho não encontrado');
    return cart;
  }

  private multiplyMoney(price: number, quantity: number): number {
    try {
      return fromCents(toCents(price) * quantity);
    } catch {
      throw new UnprocessableEntityException('Valor monetário inválido');
    }
  }

  private calculateTotal(items: CartItem[]): number {
    try {
      return fromCents(
        items.reduce((total, item) => total + toCents(item.subtotal), 0),
      );
    } catch {
      throw new UnprocessableEntityException('Total do carrinho inválido');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string };
    return driverError.code === '23505';
  }
}
