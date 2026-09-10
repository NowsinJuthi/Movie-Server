import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'playback_sessions',
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
export class PlaybackRecord {
  @Prop({ required: true, unique: true, maxlength: 64 })
  redisSessionId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true })
  profileId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  deviceKey!: string;

  @Prop({ type: String, enum: ['movie', 'episode'], required: true })
  mediaType!: 'movie' | 'episode';

  @Prop({ required: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ required: true, maxlength: 16 })
  quality!: string;

  @Prop({ default: '', maxlength: 64 })
  ip!: string;

  @Prop({ default: '', maxlength: 512 })
  userAgent!: string;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop({ required: true })
  lastHeartbeatAt!: Date;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: String, default: null, maxlength: 32 })
  endReason?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PlaybackRecordDocument = HydratedDocument<PlaybackRecord>;
export const PlaybackRecordSchema = SchemaFactory.createForClass(PlaybackRecord);

PlaybackRecordSchema.index({ userId: 1, endedAt: 1, lastHeartbeatAt: -1 });
PlaybackRecordSchema.index({ endedAt: 1, lastHeartbeatAt: -1 });
PlaybackRecordSchema.index({ mediaId: 1, endedAt: 1 });
