import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'my_list',
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
export class MyListItem {
  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 64 })
  mediaId!: string;

  @Prop({ required: true, default: Date.now })
  addedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MyListItemDocument = HydratedDocument<MyListItem>;
export const MyListItemSchema = SchemaFactory.createForClass(MyListItem);

MyListItemSchema.index({ profileId: 1, mediaId: 1 }, { unique: true });
MyListItemSchema.index({ profileId: 1, addedAt: -1 });
MyListItemSchema.index({ userId: 1, profileId: 1 });
