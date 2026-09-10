export const PaymentStatus = {
  Pending: 'pending',
  Success: 'success',
  Failed: 'failed',
  Cancelled: 'cancelled',
  Refunded: 'refunded',
  PartiallyRefunded: 'partially_refunded',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_STATUSES = [
  PaymentStatus.Pending,
  PaymentStatus.Success,
  PaymentStatus.Failed,
  PaymentStatus.Cancelled,
  PaymentStatus.Refunded,
  PaymentStatus.PartiallyRefunded,
] as const;

export const PaymentKind = {
  Checkout: 'checkout',
  Renewal: 'renewal',
  Refund: 'refund',
} as const;

export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];
export const PAYMENT_KINDS = [PaymentKind.Checkout, PaymentKind.Renewal, PaymentKind.Refund] as const;

export const InvoiceStatus = {
  Draft: 'draft',
  Open: 'open',
  Paid: 'paid',
  Void: 'void',
  Refunded: 'refunded',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export const INVOICE_STATUSES = [
  InvoiceStatus.Draft,
  InvoiceStatus.Open,
  InvoiceStatus.Paid,
  InvoiceStatus.Void,
  InvoiceStatus.Refunded,
] as const;

export const WebhookProcessStatus = {
  Received: 'received',
  Processed: 'processed',
  Ignored: 'ignored',
  Failed: 'failed',
} as const;

export type WebhookProcessStatus = (typeof WebhookProcessStatus)[keyof typeof WebhookProcessStatus];

export type InvoiceLine = {
  description: string;
  amountCents: number;
  planSlug: string;
  billingCycle: string;
};

export type PublicPayment = {
  id: string;
  userId: string;
  subscriptionId: string;
  invoiceId: string | null;
  kind: PaymentKind;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string | null;
  providerSessionId: string | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  cardBrand: string | null;
  cardLast4: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PublicInvoice = {
  id: string;
  number: string;
  userId: string;
  subscriptionId: string;
  paymentId: string | null;
  status: InvoiceStatus;
  amountCents: number;
  currency: string;
  lineItems: InvoiceLine[];
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issuedAt: string;
  paidAt: string | null;
};

export type CheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  provider: string;
  checkoutUrl: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  paymentRequired: true;
};
