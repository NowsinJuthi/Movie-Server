import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import {
  CheckoutResponse,
  ErrorCode,
  InvoiceStatus,
  PaymentKind,
  PaymentStatus,
  SubscriptionStatus,
  WebhookProcessStatus,
} from '@movie-server/shared';
import { addBillingCycle } from '../subscriptions/period';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { InvoiceCounter, InvoiceCounterDocument } from './schemas/invoice-counter.schema';
import { WebhookEvent, WebhookEventDocument } from './schemas/webhook-event.schema';
import { BillingCustomer, BillingCustomerDocument } from './schemas/billing-customer.schema';
import { PaymentProviderRegistry } from './providers/provider.registry';
import { FakePaymentProvider } from './providers/fake.provider';
import { RetrievedCheckout } from './providers/payment-provider';
import { runInTransaction } from './mongo-transaction';
import { toPublicInvoice, toPublicPayment } from './billing.mapper';

@Injectable()
export class BillingService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(InvoiceCounter.name) private readonly counters: Model<InvoiceCounterDocument>,
    @InjectModel(WebhookEvent.name) private readonly webhooks: Model<WebhookEventDocument>,
    @InjectModel(BillingCustomer.name) private readonly customers: Model<BillingCustomerDocument>,
    private readonly subscriptions: SubscriptionsService,
    private readonly providers: PaymentProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  providerId(): string {
    return this.providers.get().id;
  }

  async createCheckout(
    userId: string,
    email: string,
    input: { subscriptionId?: string; kind?: 'checkout' | 'renewal' },
    idempotencyHeader?: string,
  ): Promise<CheckoutResponse> {
    const sub = input.subscriptionId
      ? await this.subscriptions.findById(input.subscriptionId)
      : await this.subscriptions.getCurrentForUser(userId);
    if (!sub || String(sub.userId) !== userId) {
      throw new NotFoundException({
        error: ErrorCode.NotFound,
        message: 'Subscription not found.',
      });
    }

    const kind: typeof PaymentKind.Checkout | typeof PaymentKind.Renewal =
      input.kind === 'renewal' ||
      sub.status === SubscriptionStatus.Suspended ||
      sub.status === SubscriptionStatus.Expired
        ? PaymentKind.Renewal
        : PaymentKind.Checkout;

    if (kind === PaymentKind.Checkout && sub.status !== SubscriptionStatus.Pending) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'Checkout is only available for pending subscriptions.',
      });
    }
    if (
      kind === PaymentKind.Renewal &&
      sub.status !== SubscriptionStatus.Suspended &&
      sub.status !== SubscriptionStatus.Expired &&
      sub.status !== SubscriptionStatus.Active
    ) {
      throw new BadRequestException({
        error: ErrorCode.InvalidPlanChange,
        message: 'This subscription is not eligible for renewal payment.',
      });
    }

    const periodStart = kind === PaymentKind.Renewal ? new Date() : sub.currentPeriodStart;
    const periodEnd =
      kind === PaymentKind.Renewal ? addBillingCycle(periodStart, sub.billingCycle) : sub.currentPeriodEnd;
    const idempotencyKey =
      idempotencyHeader?.trim() ||
      `${kind}:${userId}:${String(sub._id)}:${periodStart.toISOString().slice(0, 10)}`;

    const existingSuccess = await this.payments.findOne({
      subscriptionId: sub._id,
      billingPeriodStart: periodStart,
      kind,
      status: PaymentStatus.Success,
    });
    if (existingSuccess) {
      throw new ConflictException({
        error: ErrorCode.DuplicatePayment,
        message: 'This billing period is already paid.',
      });
    }

    const existing = await this.payments.findOne({ idempotencyKey });
    if (existing) {
      if (existing.status === PaymentStatus.Success) {
        throw new ConflictException({
          error: ErrorCode.DuplicatePayment,
          message: 'This payment was already completed.',
        });
      }
      if (existing.status === PaymentStatus.Pending && existing.checkoutUrl && existing.providerSessionId) {
        return {
          paymentId: String(existing._id),
          invoiceId: existing.invoiceId ? String(existing.invoiceId) : '',
          provider: existing.provider,
          checkoutUrl: existing.checkoutUrl,
          sessionId: existing.providerSessionId,
          amountCents: existing.amountCents,
          currency: existing.currency,
          paymentRequired: true,
        };
      }
    }

    const amountCents = sub.priceCents;
    if (amountCents <= 0) {
      throw new BadRequestException({
        error: ErrorCode.PaymentFailed,
        message: 'Nothing to charge for this plan.',
      });
    }

    const provider = this.providers.get();
    const customer = await this.customers.findOne({ userId, provider: provider.id });
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';

    const created = await runInTransaction(this.connection, async (session) => {
      const invoiceNumber = await this.nextInvoiceNumber(session);
      const invoicePayload = {
        number: invoiceNumber,
        userId,
        subscriptionId: sub._id,
        status: InvoiceStatus.Open,
        amountCents,
        currency: sub.currency,
        lineItems: [
          {
            description: `${sub.planSlug} ${sub.billingCycle} subscription`,
            amountCents,
            planSlug: sub.planSlug,
            billingCycle: sub.billingCycle,
          },
        ],
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        issuedAt: new Date(),
      };
      const invoice = session
        ? (await this.invoices.create([invoicePayload], { session }))[0]
        : await this.invoices.create(invoicePayload);

      const paymentPayload = {
        userId,
        subscriptionId: sub._id,
        invoiceId: invoice._id,
        kind,
        status: PaymentStatus.Pending,
        provider: provider.id,
        idempotencyKey,
        amountCents,
        refundedCents: 0,
        currency: sub.currency,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      };
      const payment = session
        ? (await this.payments.create([paymentPayload], { session }))[0]
        : await this.payments.create(paymentPayload);
      invoice.paymentId = payment._id;
      await invoice.save({ session: session ?? undefined });
      return { payment, invoice };
    });

    const checkout = await provider.createCheckout({
      userId,
      email,
      subscriptionId: String(sub._id),
      paymentId: String(created.payment._id),
      planName: `AmarPin ${sub.planSlug}`,
      description: `${sub.billingCycle} billing`,
      amountCents,
      currency: sub.currency,
      successUrl: `${appUrl}/account/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/account/billing/return?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
      customerId: customer?.providerCustomerId,
    });

    created.payment.providerSessionId = checkout.sessionId;
    created.payment.providerCustomerId = checkout.customerId ?? null;
    created.payment.checkoutUrl = checkout.checkoutUrl;
    await created.payment.save();

    if (checkout.customerId) {
      await this.customers.updateOne(
        { userId },
        { userId, provider: provider.id, providerCustomerId: checkout.customerId },
        { upsert: true },
      );
    }

    await this.subscriptions.markPaymentPending(String(sub._id), {
      provider: provider.id,
      externalRef: checkout.sessionId,
    });

    return {
      paymentId: String(created.payment._id),
      invoiceId: String(created.invoice._id),
      provider: provider.id,
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
      amountCents,
      currency: sub.currency,
      paymentRequired: true,
    };
  }

  async verifyCheckout(userId: string, sessionId: string) {
    const payment = await this.payments.findOne({ providerSessionId: sessionId, userId });
    if (!payment) {
      throw new NotFoundException({
        error: ErrorCode.PaymentNotFound,
        message: 'Payment not found.',
      });
    }
    const retrieved = await this.providers.get().retrieveCheckout(sessionId);
    if (retrieved.status === 'paid') {
      await this.settlePaid(payment, retrieved);
    } else if (retrieved.status === 'failed') {
      await this.settleFailed(payment, 'Checkout verification failed.');
    } else if (retrieved.status === 'cancelled') {
      await this.settleCancelled(payment);
    }
    const fresh = await this.payments.findById(payment._id);
    return {
      payment: toPublicPayment(fresh ?? payment),
      providerStatus: retrieved.status,
    };
  }

  async handleWebhook(providerName: string, rawBody: Buffer, signature: string | undefined) {
    const provider = this.providers.get();
    if (providerName !== provider.id) {
      throw new BadRequestException({
        error: ErrorCode.WebhookInvalid,
        message: 'Unknown payment provider.',
      });
    }
    const event = provider.parseWebhook(rawBody, signature);

    const recorded = await this.claimWebhook(provider.id, event.id, event.type);
    if (!recorded.fresh) {
      return { received: true, duplicate: true, eventId: event.id };
    }

    try {
      if (event.outcome === 'ignored') {
        recorded.doc.status = WebhookProcessStatus.Ignored;
        await recorded.doc.save();
        return { received: true, ignored: true, eventId: event.id };
      }

      const payment = await this.findPaymentForEvent(event);
      if (!payment) {
        recorded.doc.status = WebhookProcessStatus.Ignored;
        recorded.doc.note = 'No matching payment.';
        await recorded.doc.save();
        return { received: true, ignored: true, eventId: event.id };
      }

      if (event.outcome === 'paid') {
        const retrieved = event.sessionId
          ? await provider.retrieveCheckout(event.sessionId).catch(() => this.checkoutFromEvent(event))
          : this.checkoutFromEvent(event);
        await this.settlePaid(payment, retrieved);
      } else if (event.outcome === 'failed') {
        await this.settleFailed(payment, 'Provider reported payment failed.');
      } else if (event.outcome === 'cancelled') {
        await this.settleCancelled(payment);
      } else if (event.outcome === 'refunded') {
        await this.applyProviderRefund(payment, event.amountCents ?? payment.amountCents, event.refundId);
      }

      recorded.doc.status = WebhookProcessStatus.Processed;
      recorded.doc.paymentId = String(payment._id);
      await recorded.doc.save();
      return { received: true, processed: true, eventId: event.id };
    } catch (error) {
      recorded.doc.status = WebhookProcessStatus.Failed;
      recorded.doc.note = error instanceof Error ? error.message : 'Webhook handling failed.';
      await recorded.doc.save();
      throw error;
    }
  }

  async simulateSuccess(userId: string, paymentId: string) {
    if (this.config.get('NODE_ENV') === 'production' || !this.providers.isFake()) {
      throw new ForbiddenException({
        error: ErrorCode.Forbidden,
        message: 'Payment simulation is disabled.',
      });
    }
    const payment = await this.requireOwnedPayment(userId, paymentId);
    const fake = this.providers.get() as FakePaymentProvider;
    if (!payment.providerSessionId) {
      throw new BadRequestException({
        error: ErrorCode.PaymentFailed,
        message: 'Checkout session missing.',
      });
    }
    fake.markSession(payment.providerSessionId, 'paid');
    return this.verifyCheckout(userId, payment.providerSessionId);
  }

  async history(userId: string) {
    const payments = await this.payments.find({ userId }).sort({ createdAt: -1 }).limit(100).exec();
    const invoices = await this.invoices.find({ userId }).sort({ issuedAt: -1 }).limit(100).exec();
    return {
      payments: payments.map(toPublicPayment),
      invoices: invoices.map(toPublicInvoice),
    };
  }

  async getInvoice(userId: string, id: string) {
    const invoice = await this.invoices.findOne({ _id: id, userId }).exec();
    if (!invoice) {
      throw new NotFoundException({
        error: ErrorCode.InvoiceNotFound,
        message: 'Invoice not found.',
      });
    }
    return toPublicInvoice(invoice);
  }

  async adminList(status?: string, userId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    const payments = await this.payments.find(filter).sort({ createdAt: -1 }).limit(200).exec();
    const invoices = await this.invoices
      .find(userId ? { userId } : {})
      .sort({ issuedAt: -1 })
      .limit(200)
      .exec();
    return {
      payments: payments.map(toPublicPayment),
      invoices: invoices.map(toPublicInvoice),
    };
  }

  async refund(paymentId: string, amountCents?: number, reason?: string) {
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundException({
        error: ErrorCode.PaymentNotFound,
        message: 'Payment not found.',
      });
    }
    if (payment.status !== PaymentStatus.Success && payment.status !== PaymentStatus.PartiallyRefunded) {
      throw new BadRequestException({
        error: ErrorCode.RefundNotAllowed,
        message: 'Only captured payments can be refunded.',
      });
    }
    const remaining = payment.amountCents - payment.refundedCents;
    const amount = amountCents ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException({
        error: ErrorCode.RefundNotAllowed,
        message: 'Invalid refund amount.',
      });
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException({
        error: ErrorCode.RefundNotAllowed,
        message: 'Missing provider payment id.',
      });
    }

    const refund = await this.providers.get().createRefund(payment.providerPaymentId, amount);
    await this.applyProviderRefund(payment, amount, refund.refundId, reason);
    const fresh = await this.payments.findById(payment._id);
    return { payment: toPublicPayment(fresh ?? payment) };
  }

  async webhookSignForTests(rawBody: Buffer): Promise<string> {
    const provider = this.providers.get();
    if (provider instanceof FakePaymentProvider) {
      return provider.sign(rawBody);
    }
    throw new BadRequestException({ error: ErrorCode.Forbidden, message: 'Not a fake provider.' });
  }

  private async settlePaid(payment: PaymentDocument, retrieved: RetrievedCheckout) {
    if (payment.status === PaymentStatus.Success) {
      return payment;
    }
    if (
      typeof retrieved.amountCents !== 'number' ||
      !Number.isFinite(retrieved.amountCents) ||
      retrieved.amountCents !== payment.amountCents
    ) {
      throw new BadRequestException({
        error: ErrorCode.PaymentFailed,
        message: 'Paid amount does not match the invoice.',
      });
    }
    if (
      retrieved.currency &&
      retrieved.currency.toLowerCase() !== String(payment.currency).toLowerCase()
    ) {
      throw new BadRequestException({
        error: ErrorCode.PaymentFailed,
        message: 'Paid currency does not match the invoice.',
      });
    }

    return runInTransaction(this.connection, async (session) => {
      const query = this.payments.findById(payment._id);
      if (session) {
        query.session(session);
      }
      const current = await query.exec();
      if (!current || current.status === PaymentStatus.Success) {
        return current ?? payment;
      }
      current.status = PaymentStatus.Success;
      current.providerPaymentId = retrieved.paymentIntentId ?? current.providerPaymentId;
      current.providerCustomerId = retrieved.customerId ?? current.providerCustomerId;
      current.cardBrand = retrieved.cardBrand;
      current.cardLast4 = retrieved.cardLast4;
      current.paidAt = new Date();
      current.failureCode = null;
      current.failureMessage = null;
      await current.save({ session: session ?? undefined });

      if (current.invoiceId) {
        await this.invoices.findByIdAndUpdate(
          current.invoiceId,
          { status: InvoiceStatus.Paid, paidAt: current.paidAt },
          { session: session ?? undefined },
        );
      }

      await this.subscriptions.activateFromPayment(
        String(current.subscriptionId),
        {
          provider: current.provider,
          externalRef: current.providerPaymentId ?? current.providerSessionId ?? String(current._id),
          paidCents: current.amountCents,
        },
        session,
      );
      return current;
    });
  }

  private async settleFailed(payment: PaymentDocument, message: string) {
    if (payment.status === PaymentStatus.Success) {
      return payment;
    }
    payment.status = PaymentStatus.Failed;
    payment.failureMessage = message;
    await payment.save();
    if (payment.kind === PaymentKind.Renewal) {
      await this.subscriptions.recordFailedRenewal(String(payment.subscriptionId), 'payment_failed');
    }
    return payment;
  }

  private async settleCancelled(payment: PaymentDocument) {
    if (payment.status === PaymentStatus.Success) {
      return payment;
    }
    payment.status = PaymentStatus.Cancelled;
    payment.cancelledAt = new Date();
    await payment.save();
    if (payment.invoiceId) {
      await this.invoices.findByIdAndUpdate(payment.invoiceId, { status: InvoiceStatus.Void });
    }
    return payment;
  }

  private async applyProviderRefund(
    payment: PaymentDocument,
    amount: number,
    refundId?: string,
    reason?: string,
  ) {
    payment.refundedCents = Math.min(payment.amountCents, payment.refundedCents + amount);
    payment.providerRefundId = refundId ?? payment.providerRefundId;
    payment.status =
      payment.refundedCents >= payment.amountCents ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
    await payment.save();
    if (payment.status === PaymentStatus.Refunded && payment.invoiceId) {
      await this.invoices.findByIdAndUpdate(payment.invoiceId, { status: InvoiceStatus.Refunded });
    }
    await this.payments.create({
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
      invoiceId: payment.invoiceId,
      parentPaymentId: payment._id,
      kind: PaymentKind.Refund,
      status: PaymentStatus.Success,
      provider: payment.provider,
      idempotencyKey: `refund:${String(payment._id)}:${refundId ?? Date.now()}`,
      providerRefundId: refundId,
      amountCents: amount,
      refundedCents: 0,
      currency: payment.currency,
      billingPeriodStart: payment.billingPeriodStart,
      billingPeriodEnd: payment.billingPeriodEnd,
      paidAt: new Date(),
      failureMessage: reason ?? null,
    });
  }

  private async findPaymentForEvent(event: {
    sessionId?: string;
    paymentIntentId?: string;
    metadata: Record<string, string>;
  }) {
    if (event.metadata?.paymentId && Types.ObjectId.isValid(event.metadata.paymentId)) {
      const byMeta = await this.payments.findById(event.metadata.paymentId);
      if (byMeta) return byMeta;
    }
    if (event.sessionId) {
      const bySession = await this.payments.findOne({ providerSessionId: event.sessionId });
      if (bySession) return bySession;
    }
    if (event.paymentIntentId) {
      const byIntent = await this.payments.findOne({ providerPaymentId: event.paymentIntentId });
      if (byIntent) return byIntent;
    }
    return null;
  }

  private checkoutFromEvent(event: {
    sessionId?: string;
    paymentIntentId?: string;
    amountCents?: number;
    currency?: string;
    metadata: Record<string, string>;
    cardBrand?: string | null;
    cardLast4?: string | null;
  }): RetrievedCheckout {
    return {
      sessionId: event.sessionId ?? '',
      paymentIntentId: event.paymentIntentId ?? null,
      customerId: null,
      status: 'paid',
      amountCents: event.amountCents ?? 0,
      currency: event.currency ?? 'usd',
      cardBrand: event.cardBrand ?? null,
      cardLast4: event.cardLast4 ?? null,
      metadata: event.metadata,
    };
  }

  private async claimWebhook(provider: string, providerEventId: string, type: string) {
    try {
      const doc = await this.webhooks.create({
        provider,
        providerEventId,
        type,
        status: WebhookProcessStatus.Received,
      });
      return { fresh: true, doc };
    } catch (error) {
      const duplicate =
        typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
      if (!duplicate) {
        throw error;
      }
      const doc = await this.webhooks.findOne({ provider, providerEventId });
      return { fresh: false, doc: doc! };
    }
  }

  private async nextInvoiceNumber(session: ClientSession | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const counter = await this.counters.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after', session: session ?? undefined },
    );
    const seq = counter?.seq ?? 1;
    return `INV-${year}-${String(seq).padStart(6, '0')}`;
  }

  private async requireOwnedPayment(userId: string, paymentId: string) {
    const payment = await this.payments.findOne({ _id: paymentId, userId });
    if (!payment) {
      throw new NotFoundException({
        error: ErrorCode.PaymentNotFound,
        message: 'Payment not found.',
      });
    }
    return payment;
  }
}
