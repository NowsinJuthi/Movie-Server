import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from './payment-provider';
import { FakePaymentProvider } from './fake.provider';
import { StripePaymentProvider } from './stripe.provider';

@Injectable()
export class PaymentProviderRegistry {
  private readonly logger = new Logger(PaymentProviderRegistry.name);
  readonly provider: PaymentProvider;

  constructor(config: ConfigService) {
    const envName = config.get<string>('NODE_ENV') ?? 'development';
    const configured = config.get<string>('PAYMENT_PROVIDER');
    const stripeKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    const stripeWebhook = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    const fakeSecret = config.get<string>('PAYMENT_WEBHOOK_SECRET') ?? 'whsec_test_cinevault_webhook_secret';
    const appUrl = config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const local =
      (() => {
        try {
          const { hostname } = new URL(appUrl);
          return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        } catch {
          return false;
        }
      })();

    if (envName === 'production' && configured === 'fake' && !local) {
      throw new Error('PAYMENT_PROVIDER=fake is not allowed on a public production origin.');
    }

    const wantStripe = configured === 'stripe' || (envName === 'production' && configured !== 'fake');
    if (wantStripe) {
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe or NODE_ENV=production.');
      }
      this.provider = new StripePaymentProvider(stripeKey, stripeWebhook);
      this.logger.log('Using Stripe payment provider.');
      return;
    }

    this.provider = new FakePaymentProvider(fakeSecret, appUrl);
    this.logger.warn('Using fake payment provider (no live card processing).');
  }

  get(): PaymentProvider {
    return this.provider;
  }

  isFake(): boolean {
    return this.provider.id === 'fake';
  }
}
