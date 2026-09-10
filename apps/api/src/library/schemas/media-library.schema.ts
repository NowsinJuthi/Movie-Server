import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  LIBRARY_KINDS,
  LibraryKind,
  STORAGE_PROVIDER_KINDS,
  StorageProviderKind,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'media_libraries',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.rootPath;
      return ret;
    },
  },
})
export class MediaLibrary {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String, enum: LIBRARY_KINDS, required: true, index: true })
  kind!: LibraryKind;

  @Prop({ type: String, enum: STORAGE_PROVIDER_KINDS, default: StorageProviderKind.Local })
  provider!: StorageProviderKind;

  @Prop({ required: true, select: false })
  rootPath!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: String, default: null })
  imageUrl?: string | null;

  @Prop({ type: String, default: null })
  imageKey?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'SmbServer', default: null, index: true })
  smbServerId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  smbShare?: string | null;

  @Prop({ type: String, default: null })
  smbRemotePath?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaLibraryDocument = HydratedDocument<MediaLibrary>;
export const MediaLibrarySchema = SchemaFactory.createForClass(MediaLibrary);

MediaLibrarySchema.index({ kind: 1, name: 1 }, { unique: true });
