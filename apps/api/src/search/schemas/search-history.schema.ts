import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'search_history' })
export class SearchHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  query!: string;

  @Prop({ required: true, lowercase: true, trim: true, maxlength: 120 })
  normalizedQuery!: string;

  @Prop({ default: 0, min: 0 })
  resultCount!: number;

  createdAt!: Date;
}

export type SearchHistoryDocument = HydratedDocument<SearchHistory>;
export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

SearchHistorySchema.index({ profileId: 1, createdAt: -1 });
SearchHistorySchema.index({ profileId: 1, normalizedQuery: 1 }, { unique: true });
SearchHistorySchema.index({ userId: 1, profileId: 1, createdAt: -1 });
