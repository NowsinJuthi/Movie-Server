import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WebhookProcessStatus } from '@movie-server/shared';

@Schema({
  timestamps: { createdAt: true, updatedAt: true },
  collection: 'webhook_events',
})
export class WebhookEvent {
  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  providerEventId!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true, default: WebhookProcessStatus.Received })
  status!: WebhookProcessStatus;

  @Prop({ type: String, default: null })
  paymentId?: string | null;

  @Prop({ type: String, default: null, maxlength: 400 })
  note?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WebhookEventDocument = HydratedDocument<WebhookEvent>;
export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

WebhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
WebhookEventSchema.index({ createdAt: -1 });
