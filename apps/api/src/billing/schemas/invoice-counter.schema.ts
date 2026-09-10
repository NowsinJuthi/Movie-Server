import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: false, collection: 'invoice_counters' })
export class InvoiceCounter {
  @Prop({ required: true, unique: true })
  year!: number;

  @Prop({ required: true, min: 0, default: 0 })
  seq!: number;
}

export type InvoiceCounterDocument = HydratedDocument<InvoiceCounter>;
export const InvoiceCounterSchema = SchemaFactory.createForClass(InvoiceCounter);
