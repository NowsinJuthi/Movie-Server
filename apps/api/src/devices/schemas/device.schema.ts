import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DEVICE_TYPES, DeviceType } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'devices',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.userId = String(ret.userId);
      delete ret._id;
      return ret;
    },
  },
})
export class Device {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  deviceKey!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String, enum: DEVICE_TYPES, default: DeviceType.Unknown })
  type!: DeviceType;

  @Prop({ type: String, default: null, maxlength: 40 })
  platform?: string | null;

  @Prop({ type: String, default: null, maxlength: 40 })
  browser?: string | null;

  @Prop({ default: '', maxlength: 512 })
  userAgent!: string;

  @Prop({ default: '', maxlength: 64 })
  ip!: string;

  @Prop({ default: false })
  countsTowardLimit!: boolean;

  @Prop({ default: false })
  revoked!: boolean;

  @Prop()
  revokedAt?: Date;

  @Prop({ default: false })
  suspicious!: boolean;

  @Prop({ type: [String], default: [] })
  flags!: string[];

  @Prop({ required: true })
  firstSeenAt!: Date;

  @Prop({ required: true })
  lastActiveAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DeviceDocument = HydratedDocument<Device>;
export const DeviceSchema = SchemaFactory.createForClass(Device);

DeviceSchema.index({ userId: 1, deviceKey: 1 }, { unique: true });
DeviceSchema.index({ userId: 1, revoked: 1, lastActiveAt: -1 });
