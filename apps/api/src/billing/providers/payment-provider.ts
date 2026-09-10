export type CheckoutCreateInput = {
  userId: string;
  email: string;
  subscriptionId: string;
  paymentId: string;
  planName: string;
  description: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
};

export type CheckoutCreateResult = {
  sessionId: string;
  checkoutUrl: string;
  customerId?: string | null;
};

export type RetrievedCheckout = {
  sessionId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  amountCents: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  metadata: Record<string, string>;
};

export type NormalizedWebhookEvent = {
  id: string;
  type: string;
  sessionId?: string;
  paymentIntentId?: string;
  refundId?: string;
  amountCents?: number;
  currency?: string;
  outcome: 'paid' | 'failed' | 'cancelled' | 'refunded' | 'ignored';
  metadata: Record<string, string>;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type RefundResult = {
  refundId: string;
  amountCents: number;
  status: string;
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutCreateInput): Promise<CheckoutCreateResult>;
  retrieveCheckout(sessionId: string): Promise<RetrievedCheckout>;
  parseWebhook(rawBody: Buffer, signature: string | undefined): NormalizedWebhookEvent;
  createRefund(providerPaymentId: string, amountCents?: number): Promise<RefundResult>;
}
