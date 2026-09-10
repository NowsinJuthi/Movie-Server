import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  MEDIA_REACTIONS,
  MediaReaction,
  PERSONALIZATION_MEDIA_KINDS,
  PersonalizationMediaKind,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'media_reactions',
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
export class MediaReactionDoc {
  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ type: String, enum: PERSONALIZATION_MEDIA_KINDS, required: true })
  kind!: PersonalizationMediaKind;

  @Prop({ type: String, enum: MEDIA_REACTIONS, required: true })
  reaction!: MediaReaction;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaReactionDocument = HydratedDocument<MediaReactionDoc>;
export const MediaReactionSchema = SchemaFactory.createForClass(MediaReactionDoc);

MediaReactionSchema.index({ profileId: 1, mediaId: 1 }, { unique: true });
MediaReactionSchema.index({ profileId: 1, reaction: 1, updatedAt: -1 });
MediaReactionSchema.index({ userId: 1, profileId: 1 });
