import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'seasons',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.seriesId = String(ret.seriesId);
      delete ret._id;
      return ret;
    },
  },
})
export class Season {
  @Prop({ type: Types.ObjectId, ref: 'Series', required: true, index: true })
  seriesId!: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  seasonNumber!: number;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: String, default: null })
  posterUrl?: string | null;

  @Prop({ type: String, default: null })
  posterKey?: string | null;

  @Prop({ type: Date, default: null })
  airDate?: Date | null;

  @Prop({ default: false, index: true })
  published!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SeasonDocument = HydratedDocument<Season>;
export const SeasonSchema = SchemaFactory.createForClass(Season);

SeasonSchema.index({ seriesId: 1, seasonNumber: 1 }, { unique: true });
SeasonSchema.index({ seriesId: 1, published: 1, seasonNumber: 1 });
SeasonSchema.index({ posterKey: 1 }, { sparse: true });
