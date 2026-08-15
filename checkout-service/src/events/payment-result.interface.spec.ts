import { parsePaymentResultMessage } from './payment-result.interface';

const validMessage = {
  paymentId: 'payment-id',
  orderId: 'order-id',
  userId: 'user-id',
  amount: 25.5,
  paymentMethod: 'pix',
  status: 'approved',
  transactionId: 'transaction-id',
  rejectionReason: null,
  processedAt: '2026-08-15T10:00:00.000Z',
} as const;

describe('parsePaymentResultMessage', () => {
  it('accepts a complete payment result', () => {
    expect(parsePaymentResultMessage(validMessage)).toEqual(validMessage);
  });

  it.each([
    { ...validMessage, paymentId: undefined },
    { ...validMessage, amount: '25.50' },
    { ...validMessage, amount: Number.NaN },
    { ...validMessage, status: 'pending' },
    { ...validMessage, transactionId: undefined },
    { ...validMessage, rejectionReason: 10 },
    { ...validMessage, processedAt: 'not-a-date' },
  ])('rejects an invalid result %#', (message: unknown) => {
    expect(() => parsePaymentResultMessage(message)).toThrow(
      'Invalid payment result message',
    );
  });
});
