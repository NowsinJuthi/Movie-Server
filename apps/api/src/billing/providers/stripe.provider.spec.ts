import Stripe from 'stripe';
import { StripePaymentProvider } from './stripe.provider';

describe('StripePaymentProvider webhook signatures', () => {
  const secret = 'whsec_test_signature_secret';
  const provider = new StripePaymentProvider('sk_test_placeholder', secret);

  it('accepts a valid Stripe-signed event and rejects a tampered one', () => {
    const payload = JSON.stringify({
      id: 'evt_test_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          payment_status: 'paid',
          status: 'complete',
          amount_total: 1599,
          currency: 'usd',
          metadata: { paymentId: 'pay_1' },
          payment_intent: 'pi_test_1',
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = provider.parseWebhook(Buffer.from(payload), signature);
    expect(event.outcome).toBe('paid');
    expect(event.sessionId).toBe('cs_test_1');
    expect(event.paymentIntentId).toBe('pi_test_1');

    expect(() => provider.parseWebhook(Buffer.from(payload), 'bad-signature')).toThrow();
    expect(() =>
      provider.parseWebhook(Buffer.from(payload.replace('1599', '1')), signature),
    ).toThrow();
  });
});
