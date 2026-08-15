import { getMetadataArgsStorage } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentStatus } from '../payment-status.enum';

describe('Payment entity metadata', () => {
  const storage = getMetadataArgsStorage();
  const column = (propertyName: string) =>
    storage.columns.find(
      (metadata) =>
        metadata.target === Payment && metadata.propertyName === propertyName,
    );

  it('defines identifiers and one payment per order', () => {
    expect(column('id')?.options).toMatchObject({ primary: true });
    expect(column('orderId')?.options.type).toBe('uuid');
    expect(column('userId')?.options.type).toBe('uuid');
    const index = storage.indices.find(
      (metadata) =>
        metadata.target === Payment && metadata.name === 'UQ_payment_order',
    );
    expect(index).toMatchObject({ columns: ['orderId'], unique: true });
  });

  it('defines monetary value, status and payment method', () => {
    expect(column('amount')?.options).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
    });
    expect(column('amount')?.options.transformer).toBeDefined();
    expect(column('status')?.options).toMatchObject({
      type: 'enum',
      enum: PaymentStatus,
      default: PaymentStatus.PENDING,
    });
    expect(column('paymentMethod')?.options).toMatchObject({
      type: 'varchar',
      length: 50,
    });
  });

  it('defines nullable result fields and timestamps', () => {
    expect(column('transactionId')?.options).toMatchObject({
      type: 'varchar',
      length: 255,
      nullable: true,
    });
    expect(column('rejectionReason')?.options).toMatchObject({
      type: 'varchar',
      length: 255,
      nullable: true,
    });
    expect(column('processedAt')?.options).toMatchObject({
      type: 'timestamp',
      nullable: true,
    });
    expect(column('createdAt')?.mode).toBe('createDate');
    expect(column('updatedAt')?.mode).toBe('updateDate');
  });
});
