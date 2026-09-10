import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { USER_ROLES, UserRole } from '@movie-server/shared';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorUserId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, maxlength: 254 })
  actorEmail!: string;

  @Prop({ type: String, enum: USER_ROLES, required: true })
  actorRole!: UserRole;

  @Prop({ required: true, maxlength: 12 })
  method!: string;

  @Prop({ required: true, maxlength: 240 })
  path!: string;

  @Prop({ required: true, maxlength: 80 })
  action!: string;

  @Prop({ type: String, default: null, maxlength: 40 })
  resource?: string | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  resourceId?: string | null;

  @Prop({ default: 0 })
  statusCode!: number;

  @Prop({ default: '', maxlength: 64 })
  ip!: string;

  @Prop({ default: '', maxlength: 512 })
  userAgent!: string;

  createdAt!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
