import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RecommendationReason } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'recommendations',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.profileId = String(ret.profileId);
      ret.userId = String(ret.userId);
      delete ret._id;
      return ret;
    },
  },
})
export class Recommendation {
  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ required: true, min: 0 })
  score!: number;

  @Prop({ type: String, enum: Object.values(RecommendationReason), required: true })
  reason!: RecommendationReason;

  @Prop({ type: String, default: 'content', maxlength: 40 })
  strategy!: string;

  @Prop({ type: String, default: null, maxlength: 64 })
  sourceMediaId?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RecommendationDocument = HydratedDocument<Recommendation>;
export const RecommendationSchema = SchemaFactory.createForClass(Recommendation);

RecommendationSchema.index({ profileId: 1, mediaId: 1 }, { unique: true });
RecommendationSchema.index({ profileId: 1, score: -1 });
RecommendationSchema.index({ userId: 1, profileId: 1 });
