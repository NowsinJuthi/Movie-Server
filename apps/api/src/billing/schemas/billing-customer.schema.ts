import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'billing_customers' })
export class BillingCustomer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  providerCustomerId!: string;
}

export type BillingCustomerDocument = HydratedDocument<BillingCustomer>;
export const BillingCustomerSchema = SchemaFactory.createForClass(BillingCustomer);

BillingCustomerSchema.index({ provider: 1, providerCustomerId: 1 }, { unique: true });
