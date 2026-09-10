import type { PublicInvoice, PublicPayment } from '@movie-server/shared';
import { InvoiceDocument } from './schemas/invoice.schema';
import { PaymentDocument } from './schemas/payment.schema';

export function toPublicPayment(payment: PaymentDocument): PublicPayment {
  return {
    id: String(payment._id),
    userId: String(payment.userId),
    subscriptionId: String(payment.subscriptionId),
    invoiceId: payment.invoiceId ? String(payment.invoiceId) : null,
    kind: payment.kind,
    status: payment.status,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId ?? null,
    providerSessionId: payment.providerSessionId ?? null,
    amountCents: payment.amountCents,
    refundedCents: payment.refundedCents,
    currency: payment.currency,
    billingPeriodStart: payment.billingPeriodStart.toISOString(),
    billingPeriodEnd: payment.billingPeriodEnd.toISOString(),
    cardBrand: payment.cardBrand ?? null,
    cardLast4: payment.cardLast4 ?? null,
    failureMessage: payment.failureMessage ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toPublicInvoice(invoice: InvoiceDocument): PublicInvoice {
  return {
    id: String(invoice._id),
    number: invoice.number,
    userId: String(invoice.userId),
    subscriptionId: String(invoice.subscriptionId),
    paymentId: invoice.paymentId ? String(invoice.paymentId) : null,
    status: invoice.status,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    billingPeriodStart: invoice.billingPeriodStart.toISOString(),
    billingPeriodEnd: invoice.billingPeriodEnd.toISOString(),
    issuedAt: invoice.issuedAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}
