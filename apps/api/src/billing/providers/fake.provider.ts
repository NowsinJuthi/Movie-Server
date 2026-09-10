import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';
import {
  CheckoutCreateInput,
  CheckoutCreateResult,
  NormalizedWebhookEvent,
  PaymentProvider,
  RefundResult,
  RetrievedCheckout,
} from './payment-provider';

type FakeSession = {
  sessionId: string;
  paymentIntentId: string;
  customerId: string;
  status: RetrievedCheckout['status'];
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
  checkoutUrl: string;
};

export class FakePaymentProvider implements PaymentProvider {
  readonly id = 'fake';
  private readonly sessions = new Map<string, FakeSession>();

  constructor(
    private readonly webhookSecret: string,
    private readonly appUrl: string,
  ) {}

  async createCheckout(input: CheckoutCreateInput): Promise<CheckoutCreateResult> {
    const sessionId = `fake_cs_${input.paymentId}`;
    const paymentIntentId = `fake_pi_${input.paymentId}`;
    const customerId = input.customerId ?? `fake_cus_${input.userId}`;
    const checkoutUrl = `${this.appUrl}/account/billing/return?session_id=${sessionId}`;
    this.sessions.set(sessionId, {
      sessionId,
      paymentIntentId,
      customerId,
      status: 'pending',
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      metadata: {
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        paymentId: input.paymentId,
      },
      checkoutUrl,
    });
    return { sessionId, checkoutUrl, customerId };
  }

  async retrieveCheckout(sessionId: string): Promise<RetrievedCheckout> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new BadRequestException({
        error: ErrorCode.PaymentNotFound,
        message: 'Checkout session not found.',
      });
    }
    return {
      sessionId: session.sessionId,
      paymentIntentId: session.paymentIntentId,
      customerId: session.customerId,
      status: session.status,
      amountCents: session.amountCents,
      currency: session.currency,
      cardBrand: session.status === 'paid' ? 'visa' : null,
      cardLast4: session.status === 'paid' ? '4242' : null,
      metadata: session.metadata,
    };
  }

  markSession(
    sessionId: string,
    status: RetrievedCheckout['status'],
  ): FakeSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    session.status = status;
    this.sessions.set(sessionId, session);
    return session;
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): NormalizedWebhookEvent {
    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
    if (!signature || !this.verify(payload, signature)) {
      throw new BadRequestException({
        error: ErrorCode.WebhookInvalid,
        message: 'Invalid webhook signature.',
      });
    }
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      type: string;
      data?: {
        sessionId?: string;
        paymentIntentId?: string;
        refundId?: string;
        amountCents?: number;
        currency?: string;
        metadata?: Record<string, string>;
      };
    };
    const type = parsed.type;
    let outcome: NormalizedWebhookEvent['outcome'] = 'ignored';
    if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
      outcome = 'paid';
    } else if (type === 'payment_intent.payment_failed' || type === 'checkout.session.async_payment_failed') {
      outcome = 'failed';
    } else if (type === 'checkout.session.expired') {
      outcome = 'cancelled';
    } else if (type === 'charge.refunded') {
      outcome = 'refunded';
    }
    const sessionId = parsed.data?.sessionId;
    if (sessionId && outcome === 'paid') {
      this.markSession(sessionId, 'paid');
    }
    if (sessionId && outcome === 'failed') {
      this.markSession(sessionId, 'failed');
    }
    if (sessionId && outcome === 'cancelled') {
      this.markSession(sessionId, 'cancelled');
    }
    return {
      id: parsed.id,
      type,
      sessionId,
      paymentIntentId: parsed.data?.paymentIntentId,
      refundId: parsed.data?.refundId,
      amountCents: parsed.data?.amountCents,
      currency: parsed.data?.currency,
      outcome,
      metadata: parsed.data?.metadata ?? {},
      cardBrand: outcome === 'paid' ? 'visa' : null,
      cardLast4: outcome === 'paid' ? '4242' : null,
    };
  }

  async createRefund(providerPaymentId: string, amountCents?: number): Promise<RefundResult> {
    return {
      refundId: `fake_re_${providerPaymentId}`,
      amountCents: amountCents ?? 0,
      status: 'succeeded',
    };
  }

  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  private verify(rawBody: Buffer, signature: string): boolean {
    if (this.matches(rawBody, signature)) {
      return true;
    }
    try {
      const canonical = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString('utf8'))));
      return this.matches(canonical, signature);
    } catch {
      return false;
    }
  }

  private matches(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
