import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'role_permissions' })
export class RolePermissions {
  @Prop({ required: true, unique: true, default: 'global' })
  key!: string;

  @Prop({ type: Object, default: {} })
  roles!: Record<string, Record<string, boolean>>;
}

export type RolePermissionsDocument = HydratedDocument<RolePermissions>;
export const RolePermissionsSchema = SchemaFactory.createForClass(RolePermissions);
