export interface PaymentResultMessage {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  status: 'approved' | 'rejected';
  transactionId: string | null;
  rejectionReason: string | null;
  processedAt: string;
}
