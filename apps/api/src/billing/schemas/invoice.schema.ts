import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { INVOICE_STATUSES, InvoiceLine, InvoiceStatus } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'invoices',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.userId = String(ret.userId);
      ret.subscriptionId = String(ret.subscriptionId);
      if (ret.paymentId) ret.paymentId = String(ret.paymentId);
      delete ret._id;
      return ret;
    },
  },
})
export class Invoice {
  @Prop({ required: true, unique: true })
  number!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscriptionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null })
  paymentId?: Types.ObjectId | null;

  @Prop({ type: String, enum: INVOICE_STATUSES, required: true, index: true })
  status!: InvoiceStatus;

  @Prop({ required: true, min: 0 })
  amountCents!: number;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ type: [Object], default: [] })
  lineItems!: InvoiceLine[];

  @Prop({ required: true })
  billingPeriodStart!: Date;

  @Prop({ required: true })
  billingPeriodEnd!: Date;

  @Prop({ required: true })
  issuedAt!: Date;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ userId: 1, issuedAt: -1 });
InvoiceSchema.index({ status: 1, issuedAt: -1 });
