import { BadRequestException, Logger } from '@nestjs/common';
import { ErrorCode } from '@movie-server/shared';
import Stripe from 'stripe';
import {
  CheckoutCreateInput,
  CheckoutCreateResult,
  NormalizedWebhookEvent,
  PaymentProvider,
  RefundResult,
  RetrievedCheckout,
} from './payment-provider';

export class StripePaymentProvider implements PaymentProvider {
  readonly id = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, {
      appInfo: { name: 'AmarPin', version: '0.1.0' },
    });
  }

  async createCheckout(input: CheckoutCreateInput): Promise<CheckoutCreateResult> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer: input.customerId || undefined,
        customer_email: input.customerId ? undefined : input.email,
        client_reference_id: input.userId,
        metadata: {
          userId: input.userId,
          subscriptionId: input.subscriptionId,
          paymentId: input.paymentId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: {
                name: input.planName,
                description: input.description,
              },
            },
          },
        ],
        payment_intent_data: {
          metadata: {
            userId: input.userId,
            subscriptionId: input.subscriptionId,
            paymentId: input.paymentId,
          },
          setup_future_usage: 'off_session',
        },
      },
      { idempotencyKey: `checkout_${input.paymentId}` },
    );
    if (!session.url) {
      throw new BadRequestException({
        error: ErrorCode.ProviderUnavailable,
        message: 'Stripe did not return a checkout URL.',
      });
    }
    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    };
  }

  async retrieveCheckout(sessionId: string): Promise<RetrievedCheckout> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'payment_intent.latest_charge'],
    });
    const intent = session.payment_intent;
    const paymentIntentId = typeof intent === 'string' ? intent : intent?.id ?? null;
    const charge =
      intent && typeof intent !== 'string' && intent.latest_charge && typeof intent.latest_charge !== 'string'
        ? intent.latest_charge
        : null;
    const card = charge?.payment_method_details?.card;
    let status: RetrievedCheckout['status'] = 'pending';
    if (session.payment_status === 'paid' || session.status === 'complete') {
      status = 'paid';
    } else if (session.status === 'expired') {
      status = 'cancelled';
    } else if (session.status === 'open') {
      status = 'pending';
    }
    return {
      sessionId: session.id,
      paymentIntentId,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      status,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      metadata: (session.metadata ?? {}) as Record<string, string>,
    };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): NormalizedWebhookEvent {
    if (!signature) {
      throw new BadRequestException({
        error: ErrorCode.WebhookInvalid,
        message: 'Missing Stripe signature.',
      });
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn(`Stripe webhook signature failed: ${error instanceof Error ? error.message : error}`);
      throw new BadRequestException({
        error: ErrorCode.WebhookInvalid,
        message: 'Invalid Stripe webhook signature.',
      });
    }

    const metadata: Record<string, string> = {};
    let sessionId: string | undefined;
    let paymentIntentId: string | undefined;
    let refundId: string | undefined;
    let amountCents: number | undefined;
    let currency: string | undefined;
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    let outcome: NormalizedWebhookEvent['outcome'] = 'ignored';

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        sessionId = session.id;
        paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        amountCents = session.amount_total ?? undefined;
        currency = session.currency ?? undefined;
        Object.assign(metadata, session.metadata ?? {});
        outcome = session.payment_status === 'paid' || session.status === 'complete' ? 'paid' : 'ignored';
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        sessionId = session.id;
        Object.assign(metadata, session.metadata ?? {});
        outcome = 'cancelled';
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        sessionId = session.id;
        Object.assign(metadata, session.metadata ?? {});
        outcome = 'failed';
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        paymentIntentId = intent.id;
        amountCents = intent.amount_received;
        currency = intent.currency;
        Object.assign(metadata, intent.metadata ?? {});
        outcome = 'paid';
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        paymentIntentId = intent.id;
        Object.assign(metadata, intent.metadata ?? {});
        outcome = 'failed';
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : undefined;
        amountCents = charge.amount_refunded;
        currency = charge.currency;
        cardBrand = charge.payment_method_details?.card?.brand ?? null;
        cardLast4 = charge.payment_method_details?.card?.last4 ?? null;
        outcome = 'refunded';
        break;
      }
      default:
        outcome = 'ignored';
    }

    return {
      id: event.id,
      type: event.type,
      sessionId,
      paymentIntentId,
      refundId,
      amountCents,
      currency,
      outcome,
      metadata,
      cardBrand,
      cardLast4,
    };
  }

  async createRefund(providerPaymentId: string, amountCents?: number): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: providerPaymentId,
      amount: amountCents,
    });
    return {
      refundId: refund.id,
      amountCents: refund.amount,
      status: refund.status ?? 'succeeded',
    };
  }
}
