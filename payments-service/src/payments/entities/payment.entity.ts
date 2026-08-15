import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalNumberTransformer } from '../money';
import { PaymentStatus } from '../payment-status.enum';

@Entity('payments')
@Index('UQ_payment_order', ['orderId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalNumberTransformer,
  })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
