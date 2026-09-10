import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BILLING_CYCLES,
  BillingCycle,
  PLAN_FEATURES,
  PlanFeature,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  VIDEO_QUALITIES,
  VideoQuality,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'subscriptions',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.userId = String(ret.userId);
      ret.planId = String(ret.planId);
      if (ret.scheduledPlanId) {
        ret.scheduledPlanId = String(ret.scheduledPlanId);
      }
      delete ret._id;
      return ret;
    },
  },
})
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true, index: true })
  planId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  planSlug!: string;

  @Prop({ required: true, min: 1 })
  planRank!: number;

  @Prop({ type: String, enum: VIDEO_QUALITIES, required: true })
  maxVideoQuality!: VideoQuality;

  @Prop({ required: true, min: 1 })
  maxDevices!: number;

  @Prop({ required: true, min: 1 })
  maxStreams!: number;

  @Prop({ type: [String], enum: PLAN_FEATURES, default: [] })
  features!: PlanFeature[];

  @Prop({ type: String, enum: BILLING_CYCLES, required: true })
  billingCycle!: BillingCycle;

  @Prop({ type: String, enum: SUBSCRIPTION_STATUSES, required: true, index: true })
  status!: SubscriptionStatus;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ required: true, min: 0 })
  priceCents!: number;

  @Prop({ default: true })
  autoRenew!: boolean;

  @Prop({ default: false })
  cancelAtPeriodEnd!: boolean;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop({ required: true })
  currentPeriodStart!: Date;

  @Prop({ required: true, index: true })
  currentPeriodEnd!: Date;

  @Prop({ type: Date, default: null })
  trialStart?: Date | null;

  @Prop({ type: Date, default: null })
  trialEnd?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: Date, default: null })
  gracePeriodEndsAt?: Date | null;

  @Prop({ type: Date, default: null })
  suspendedAt?: Date | null;

  @Prop({ type: String, default: null })
  suspensionReason?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Plan', default: null })
  scheduledPlanId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  scheduledBillingCycle?: BillingCycle | null;

  @Prop({ type: Date, default: null })
  scheduledChangeAt?: Date | null;

  @Prop({ default: 'none' })
  paymentProvider!: string;

  @Prop({ type: String })
  externalPaymentRef?: string | null;

  @Prop({ type: Date, default: null })
  lastRenewedAt?: Date | null;

  @Prop({ default: true, index: true })
  isCurrent!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SubscriptionDocument = HydratedDocument<Subscription>;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } },
);
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
SubscriptionSchema.index(
  { paymentProvider: 1, externalPaymentRef: 1 },
  { unique: true, partialFilterExpression: { externalPaymentRef: { $type: 'string' } } },
);
