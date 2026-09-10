import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PAYMENT_KINDS,
  PAYMENT_STATUSES,
  PaymentKind,
  PaymentStatus,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'payments',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.userId = String(ret.userId);
      ret.subscriptionId = String(ret.subscriptionId);
      if (ret.invoiceId) ret.invoiceId = String(ret.invoiceId);
      if (ret.parentPaymentId) ret.parentPaymentId = String(ret.parentPaymentId);
      delete ret._id;
      return ret;
    },
  },
})
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscriptionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', default: null })
  invoiceId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null })
  parentPaymentId?: Types.ObjectId | null;

  @Prop({ type: String, enum: PAYMENT_KINDS, required: true })
  kind!: PaymentKind;

  @Prop({ type: String, enum: PAYMENT_STATUSES, required: true, index: true })
  status!: PaymentStatus;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({ type: String, default: null })
  providerPaymentId?: string | null;

  @Prop({ type: String, default: null })
  providerSessionId?: string | null;

  @Prop({ type: String, default: null })
  providerCustomerId?: string | null;

  @Prop({ type: String, default: null })
  providerRefundId?: string | null;

  @Prop({ required: true, min: 0 })
  amountCents!: number;

  @Prop({ default: 0, min: 0 })
  refundedCents!: number;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ required: true })
  billingPeriodStart!: Date;

  @Prop({ required: true })
  billingPeriodEnd!: Date;

  @Prop({ type: String, default: null })
  cardBrand?: string | null;

  @Prop({ type: String, default: null, match: /^[0-9]{4}$/ })
  cardLast4?: string | null;

  @Prop({ type: String, default: null })
  failureCode?: string | null;

  @Prop({ type: String, default: null, maxlength: 400 })
  failureMessage?: string | null;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: String, default: null })
  checkoutUrl?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ subscriptionId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } },
);
PaymentSchema.index(
  { provider: 1, providerSessionId: 1 },
  { unique: true, partialFilterExpression: { providerSessionId: { $type: 'string' } } },
);
PaymentSchema.index(
  { subscriptionId: 1, billingPeriodStart: 1, kind: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'success',
      kind: { $in: ['checkout', 'renewal'] },
    },
  },
);
