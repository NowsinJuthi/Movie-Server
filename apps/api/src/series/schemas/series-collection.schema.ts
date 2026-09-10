import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'series_collections',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
})
export class SeriesCollection {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 80 })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ default: '', trim: true, maxlength: 800 })
  description!: string;

  @Prop({ type: String, default: null })
  posterUrl?: string | null;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SeriesCollectionDocument = HydratedDocument<SeriesCollection>;
export const SeriesCollectionSchema = SchemaFactory.createForClass(SeriesCollection);

SeriesCollectionSchema.index({ sortOrder: 1, name: 1 });
