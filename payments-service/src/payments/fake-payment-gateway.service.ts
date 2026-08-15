import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { toCents } from './money';

export interface PaymentGatewayResult {
  approved: boolean;
  transactionId?: string;
  rejectionReason?: string;
}

@Injectable()
export class FakePaymentGatewayService {
  private readonly processingDelayMs = 500;

  async process(amount: number): Promise<PaymentGatewayResult> {
    await new Promise((resolve) => setTimeout(resolve, this.processingDelayMs));

    const amountInCents = toCents(amount);

    if (amountInCents > 1_000_000) {
      return { approved: false, rejectionReason: 'Limite excedido' };
    }

    if (amountInCents % 100 === 99) {
      return {
        approved: false,
        rejectionReason: 'Cartão recusado pela operadora',
      };
    }

    return { approved: true, transactionId: randomUUID() };
  }
}
