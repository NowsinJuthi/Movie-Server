import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'sessions',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.tokenHash;
      delete ret.replacedByHash;
      return ret;
    },
  },
})
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Profile', default: null })
  activeProfileId?: Types.ObjectId | null;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ default: '' })
  userAgent!: string;

  @Prop({ default: '' })
  ip!: string;

  @Prop({ type: Types.ObjectId, ref: 'Device', default: null })
  deviceId?: Types.ObjectId | null;

  @Prop({ default: '', maxlength: 80 })
  deviceKey!: string;

  @Prop({ default: '', maxlength: 80 })
  clientName!: string;

  @Prop({ default: '', maxlength: 24 })
  deviceType!: string;

  @Prop({ default: '', maxlength: 40 })
  browser!: string;

  @Prop({ default: () => new Date() })
  lastActiveAt!: Date;

  @Prop({ default: false })
  suspicious!: boolean;

  @Prop({ type: [String], default: [] })
  flags!: string[];

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ default: false })
  revoked!: boolean;

  @Prop()
  replacedByHash?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ userId: 1, revoked: 1, expiresAt: 1 });
SessionSchema.index({ userId: 1, deviceKey: 1, revoked: 1 });
SessionSchema.index({ suspicious: 1, lastActiveAt: -1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
