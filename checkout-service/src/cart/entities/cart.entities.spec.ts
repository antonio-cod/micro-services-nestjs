import { getMetadataArgsStorage } from 'typeorm';
import { CartItem } from './cart-item.entity';
import { Cart, CartStatus } from './cart.entity';

describe('Cart entities metadata', () => {
  const storage = getMetadataArgsStorage();

  function column(target: object, propertyName: string) {
    return storage.columns.find(
      (metadata) =>
        metadata.target === target && metadata.propertyName === propertyName,
    );
  }

  it('defines Cart columns, defaults and timestamps', () => {
    expect(column(Cart, 'id')?.options).toMatchObject({ primary: true });
    expect(column(Cart, 'userId')?.options.type).toBe('uuid');
    expect(column(Cart, 'status')?.options).toMatchObject({
      type: 'enum',
      enum: CartStatus,
      default: CartStatus.ACTIVE,
    });
    expect(column(Cart, 'total')?.options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
      default: 0,
    });
    expect(column(Cart, 'createdAt')?.mode).toBe('createDate');
    expect(column(Cart, 'updatedAt')?.mode).toBe('updateDate');
  });

  it('defines eager and cascading items', () => {
    const relation = storage.relations.find(
      (metadata) =>
        metadata.target === Cart && metadata.propertyName === 'items',
    );

    expect(relation?.relationType).toBe('one-to-many');
    expect(relation?.options).toMatchObject({ eager: true, cascade: true });
  });

  it('enforces one active cart per user', () => {
    expect(
      storage.indices.find(
        (metadata) =>
          metadata.target === Cart && metadata.name === 'UQ_cart_active_user',
      ),
    ).toMatchObject({ unique: true, where: `"status" = 'active'` });
  });

  it('defines CartItem columns and the explicit cart join column', () => {
    expect(column(CartItem, 'cartId')?.options.type).toBe('uuid');
    expect(column(CartItem, 'productId')?.options.type).toBe('uuid');
    expect(column(CartItem, 'productName')?.options).toMatchObject({
      type: 'varchar',
      length: 255,
    });
    expect(column(CartItem, 'price')?.options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
    });
    expect(column(CartItem, 'quantity')?.options).toMatchObject({
      type: 'int',
      default: 1,
    });
    expect(column(CartItem, 'subtotal')?.options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
    });
    expect(column(CartItem, 'createdAt')?.mode).toBe('createDate');

    const relation = storage.relations.find(
      (metadata) =>
        metadata.target === CartItem && metadata.propertyName === 'cart',
    );
    expect(relation?.relationType).toBe('many-to-one');
    expect(relation?.options).toMatchObject({
      nullable: false,
      onDelete: 'CASCADE',
    });
    expect(
      storage.joinColumns.find(
        (metadata) =>
          metadata.target === CartItem && metadata.propertyName === 'cart',
      )?.name,
    ).toBe('cartId');
  });

  it('enforces one item per product in a cart', () => {
    const index = storage.indices.find(
      (metadata) =>
        metadata.target === CartItem &&
        metadata.name === 'UQ_cart_item_product',
    );
    expect(index?.columns).toEqual(['cartId', 'productId']);
    expect(index).toMatchObject({ unique: true });
  });
});
