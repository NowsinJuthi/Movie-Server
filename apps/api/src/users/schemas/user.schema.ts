import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      delete ret.emailVerificationTokenHash;
      delete ret.passwordResetTokenHash;
      delete ret.tokenVersion;
      return ret;
    },
  },
})
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  displayName!: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.User,
    index: true,
  })
  role!: UserRole;

  /** Staff permission profile for admin accounts (maps to role_permissions profiles). */
  @Prop({ type: String, trim: true, default: 'administrator' })
  staffProfileId?: string;

  /** Per-user subscription permission overrides for staff (null field = inherit profile). */
  @Prop({
    type: {
      view: { type: Boolean, default: null },
      manage: { type: Boolean, default: null },
    },
    _id: false,
    default: undefined,
  })
  subscriptionStaffRules?: {
    view: boolean | null;
    manage: boolean | null;
  };

  @Prop({ default: false, index: true })
  emailVerified!: boolean;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ select: false })
  emailVerificationTokenHash?: string;

  @Prop()
  emailVerificationExpiresAt?: Date;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop()
  passwordResetExpiresAt?: Date;

  @Prop({ default: 0, min: 0 })
  failedLoginAttempts!: number;

  @Prop()
  lockUntil?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ default: 0, select: false })
  tokenVersion!: number;

  @Prop()
  passwordChangedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ emailVerified: 1, isActive: 1 });
UserSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true, unique: true });
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true, unique: true });
UserSchema.index({ lockUntil: 1 }, { sparse: true });
