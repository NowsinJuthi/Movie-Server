import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'watch_history',
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
export class WatchHistory {
  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ required: true, min: 0, default: 0 })
  progressSeconds!: number;

  @Prop({ required: true, min: 1 })
  durationSeconds!: number;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ required: true })
  lastWatchedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WatchHistoryDocument = HydratedDocument<WatchHistory>;
export const WatchHistorySchema = SchemaFactory.createForClass(WatchHistory);

WatchHistorySchema.index({ profileId: 1, mediaId: 1 }, { unique: true });
WatchHistorySchema.index({ profileId: 1, lastWatchedAt: -1 });
WatchHistorySchema.index({ profileId: 1, completed: 1, lastWatchedAt: -1 });
WatchHistorySchema.index({ userId: 1, profileId: 1 });
