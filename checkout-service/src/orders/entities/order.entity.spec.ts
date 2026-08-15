import { getMetadataArgsStorage } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './order.entity';

describe('Order entity metadata', () => {
  const storage = getMetadataArgsStorage();
  const column = (propertyName: string) =>
    storage.columns.find(
      (metadata) =>
        metadata.target === Order && metadata.propertyName === propertyName,
    );

  it('defines identifiers, monetary value and payment method', () => {
    expect(column('id')?.options).toMatchObject({ primary: true });
    expect(column('userId')?.options.type).toBe('uuid');
    expect(column('cartId')?.options.type).toBe('uuid');
    expect(column('total')?.options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
    });
    expect(column('total')?.options.transformer).toBeDefined();
    expect(column('paymentMethod')?.options).toMatchObject({
      type: 'varchar',
      length: 50,
    });
  });

  it('defines supported payment methods and one order per cart', () => {
    expect(Object.values(PaymentMethod)).toEqual([
      'credit_card',
      'debit_card',
      'pix',
      'boleto',
    ]);
    const index = storage.indices.find(
      (metadata) =>
        metadata.target === Order && metadata.name === 'UQ_order_cart',
    );
    expect(index?.columns).toEqual(['cartId']);
    expect(index).toMatchObject({ unique: true });
  });

  it('defines status and timestamps', () => {
    expect(column('status')?.options).toMatchObject({
      type: 'enum',
      enum: OrderStatus,
      default: OrderStatus.PENDING,
    });
    expect(column('createdAt')?.mode).toBe('createDate');
    expect(column('updatedAt')?.mode).toBe('updateDate');
  });
});
