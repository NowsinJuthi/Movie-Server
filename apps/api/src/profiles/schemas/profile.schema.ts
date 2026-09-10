import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  MATURITY_LEVELS,
  MaturityLevel,
  PRESET_AVATARS,
  PROFILE_LANGUAGES,
  SUBTITLE_LANGUAGES,
  type ProfileLanguage,
  type SubtitleLanguage,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'profiles',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.userId = String(ret.userId);
      delete ret._id;
      delete ret.pinHash;
      delete ret.failedPinAttempts;
      return ret;
    },
  },
})
export class Profile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 20 })
  name!: string;

  @Prop({ type: String, default: PRESET_AVATARS[0] })
  avatarKey!: string;

  @Prop({ type: String, default: null })
  avatarFileName?: string | null;

  @Prop({ default: false })
  isKids!: boolean;

  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ type: String, enum: PROFILE_LANGUAGES, default: 'en' })
  language!: ProfileLanguage;

  @Prop({ type: String, enum: PROFILE_LANGUAGES, default: 'en' })
  audioLanguage!: ProfileLanguage;

  @Prop({ type: String, enum: SUBTITLE_LANGUAGES, default: 'off' })
  subtitleLanguage!: SubtitleLanguage;

  @Prop({ type: String, enum: MATURITY_LEVELS, default: MaturityLevel.Mature })
  maturityLevel!: MaturityLevel;

  @Prop({ select: false })
  pinHash?: string;

  @Prop({ default: false })
  hasPin!: boolean;

  @Prop({ default: 0, min: 0 })
  failedPinAttempts!: number;

  @Prop()
  pinLockUntil?: Date;

  @Prop()
  lastSelectedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ProfileDocument = HydratedDocument<Profile>;
export const ProfileSchema = SchemaFactory.createForClass(Profile);

ProfileSchema.index({ userId: 1, name: 1 }, { unique: true });
ProfileSchema.index({ userId: 1, createdAt: 1 });
ProfileSchema.index({ userId: 1, isDefault: 1 });
