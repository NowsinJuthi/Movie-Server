import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  MEDIA_ASSET_STATUSES,
  MEDIA_KINDS,
  MediaAssetStatus,
  MediaKind,
  SUBTITLE_FORMATS,
  VIDEO_RESOLUTIONS,
  VideoResolution,
  type SubtitleFormat,
} from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'media_assets',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.movieId = ret.movieId ? String(ret.movieId) : null;
      ret.episodeId = ret.episodeId ? String(ret.episodeId) : null;
      if (ret.libraryItemId) ret.libraryItemId = String(ret.libraryItemId);
      delete ret._id;
      delete ret.storagePath;
      return ret;
    },
  },
})
export class MediaAsset {
  @Prop({ type: Types.ObjectId, ref: 'Movie', default: null, index: true })
  movieId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Episode', default: null, index: true })
  episodeId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'LibraryItem', default: null, index: true })
  libraryItemId?: Types.ObjectId | null;

  @Prop({ type: String, enum: MEDIA_KINDS, required: true, index: true })
  kind!: MediaKind;

  @Prop({ required: true, unique: true })
  storageKey!: string;

  @Prop({ select: false, type: String, default: null })
  storagePath?: string | null;

  @Prop({ type: String, enum: VIDEO_RESOLUTIONS, default: null })
  quality?: VideoResolution | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true, maxlength: 12 })
  language?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 80 })
  label?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 40 })
  codec?: string | null;

  @Prop({ type: Number, default: null, min: 1, max: 16 })
  channels?: number | null;

  @Prop({ type: String, enum: SUBTITLE_FORMATS, default: null })
  format?: SubtitleFormat | null;

  @Prop({ type: Number, default: null, min: 0 })
  bitrateKbps?: number | null;

  @Prop({ default: false })
  forced?: boolean;

  @Prop({ default: false })
  hearingImpaired?: boolean;

  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: String, enum: MEDIA_ASSET_STATUSES, default: MediaAssetStatus.Missing })
  status!: MediaAssetStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaAssetDocument = HydratedDocument<MediaAsset>;
export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);

MediaAssetSchema.index({ movieId: 1, kind: 1, sortOrder: 1 });
MediaAssetSchema.index({ movieId: 1, kind: 1, quality: 1 });
MediaAssetSchema.index({ movieId: 1, status: 1 });
MediaAssetSchema.index({ episodeId: 1, kind: 1, sortOrder: 1 });
MediaAssetSchema.index({ episodeId: 1, kind: 1, quality: 1 });
MediaAssetSchema.index({ episodeId: 1, status: 1 });
MediaAssetSchema.index({ libraryItemId: 1, kind: 1 });
MediaAssetSchema.index({ status: 1, kind: 1, language: 1, movieId: 1 });
MediaAssetSchema.index({ status: 1, kind: 1, quality: 1, movieId: 1 });
MediaAssetSchema.index({ status: 1, kind: 1, language: 1, episodeId: 1 });
MediaAssetSchema.index({ status: 1, kind: 1, quality: 1, episodeId: 1 });
