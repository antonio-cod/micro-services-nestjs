import { getMetadataArgsStorage } from 'typeorm';
import { Order, OrderStatus } from './order.entity';

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
    expect(column('paymentMethod')?.options).toMatchObject({
      type: 'varchar',
      length: 50,
    });
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
