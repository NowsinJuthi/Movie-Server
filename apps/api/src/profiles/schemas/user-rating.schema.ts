import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PERSONALIZATION_MEDIA_KINDS, PersonalizationMediaKind } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'user_ratings',
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
export class UserRating {
  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ type: String, enum: PERSONALIZATION_MEDIA_KINDS, required: true })
  kind!: PersonalizationMediaKind;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserRatingDocument = HydratedDocument<UserRating>;
export const UserRatingSchema = SchemaFactory.createForClass(UserRating);

UserRatingSchema.index({ profileId: 1, mediaId: 1 }, { unique: true });
UserRatingSchema.index({ profileId: 1, rating: -1, updatedAt: -1 });
UserRatingSchema.index({ userId: 1, profileId: 1 });
