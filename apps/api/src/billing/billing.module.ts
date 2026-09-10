import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { InvoiceCounter, InvoiceCounterSchema } from './schemas/invoice-counter.schema';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';
import { BillingCustomer, BillingCustomerSchema } from './schemas/billing-customer.schema';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AdminBillingController } from './admin-billing.controller';
import { PaymentProviderRegistry } from './providers/provider.registry';

@Module({
  imports: [
    SubscriptionsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: InvoiceCounter.name, schema: InvoiceCounterSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      { name: BillingCustomer.name, schema: BillingCustomerSchema },
    ]),
  ],
  controllers: [BillingController, AdminBillingController],
  providers: [PaymentProviderRegistry, BillingService],
  exports: [BillingService, PaymentProviderRegistry],
})
export class BillingModule {}
