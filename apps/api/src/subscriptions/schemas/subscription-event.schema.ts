import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BillingCycle,
  SubscriptionEventType,
  SubscriptionStatus,
} from '@movie-server/shared';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'subscription_events',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.subscriptionId = String(ret.subscriptionId);
      ret.userId = String(ret.userId);
      delete ret._id;
      return ret;
    },
  },
})
export class SubscriptionEvent {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscriptionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  type!: SubscriptionEventType;

  @Prop({ type: String, default: null })
  fromPlanSlug?: string | null;

  @Prop({ type: String, default: null })
  toPlanSlug?: string | null;

  @Prop({ type: String, default: null })
  fromStatus?: SubscriptionStatus | null;

  @Prop({ type: String, default: null })
  toStatus?: SubscriptionStatus | null;

  @Prop({ type: String, default: null })
  billingCycle?: BillingCycle | null;

  @Prop({ type: String, default: null, maxlength: 400 })
  note?: string | null;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;

  createdAt!: Date;
}

export type SubscriptionEventDocument = HydratedDocument<SubscriptionEvent>;
export const SubscriptionEventSchema = SchemaFactory.createForClass(SubscriptionEvent);

SubscriptionEventSchema.index({ userId: 1, createdAt: -1 });
SubscriptionEventSchema.index({ subscriptionId: 1, createdAt: -1 });
SubscriptionEventSchema.index({ userId: 1, type: 1, createdAt: -1 });
