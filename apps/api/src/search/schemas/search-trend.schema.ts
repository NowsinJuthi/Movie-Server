import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'search_trends' })
export class SearchTrend {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 120 })
  normalizedQuery!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  query!: string;

  @Prop({ default: 1, min: 0, index: true })
  count!: number;

  @Prop({ type: Date, default: Date.now, index: true })
  lastSearchedAt!: Date;
}

export type SearchTrendDocument = HydratedDocument<SearchTrend>;
export const SearchTrendSchema = SchemaFactory.createForClass(SearchTrend);

SearchTrendSchema.index({ count: -1, lastSearchedAt: -1 });
SearchTrendSchema.index({ lastSearchedAt: -1, count: -1 });
