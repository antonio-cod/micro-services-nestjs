import { isISO8601 } from 'class-validator';

export type PaymentResultStatus = 'approved' | 'rejected';

export interface PaymentResultMessage {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  status: PaymentResultStatus;
  transactionId: string | null;
  rejectionReason: string | null;
  processedAt: string;
}

export function parsePaymentResultMessage(
  input: unknown,
): PaymentResultMessage {
  if (!isRecord(input)) {
    throw new Error('Invalid payment result message');
  }

  const requiredKeys: Array<keyof PaymentResultMessage> = [
    'paymentId',
    'orderId',
    'userId',
    'amount',
    'paymentMethod',
    'status',
    'transactionId',
    'rejectionReason',
    'processedAt',
  ];

  if (
    !requiredKeys.every(
      (key: keyof PaymentResultMessage): boolean => key in input,
    )
  ) {
    throw new Error('Invalid payment result message');
  }

  if (
    !isNonEmptyString(input.paymentId) ||
    !isNonEmptyString(input.orderId) ||
    !isNonEmptyString(input.userId) ||
    typeof input.amount !== 'number' ||
    !Number.isFinite(input.amount) ||
    !isNonEmptyString(input.paymentMethod) ||
    (input.status !== 'approved' && input.status !== 'rejected') ||
    !isNullableString(input.transactionId) ||
    !isNullableString(input.rejectionReason) ||
    typeof input.processedAt !== 'string' ||
    !isISO8601(input.processedAt, { strict: true, strictSeparator: true })
  ) {
    throw new Error('Invalid payment result message');
  }

  return {
    paymentId: input.paymentId,
    orderId: input.orderId,
    userId: input.userId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    status: input.status,
    transactionId: input.transactionId,
    rejectionReason: input.rejectionReason,
    processedAt: input.processedAt,
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0;
}

function isNullableString(input: unknown): input is string | null {
  return input === null || isNonEmptyString(input);
}
