import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  LIBRARY_FILE_KINDS,
  LIBRARY_ITEM_STATUSES,
  LIBRARY_MATCH_TYPES,
  LibraryFileKind,
  LibraryItemStatus,
  LibraryMatchType,
  ProbeAudioTrack,
  ProbeSubtitleTrack,
  ProbeVideoStream,
  VIDEO_RESOLUTIONS,
  VideoResolution,
} from '@movie-server/shared';

@Schema({ _id: false })
export class LibraryProbeEmbed {
  @Prop({ type: Number, default: null })
  durationMs?: number | null;

  @Prop({ type: Number, default: null })
  width?: number | null;

  @Prop({ type: Number, default: null })
  height?: number | null;

  @Prop({ type: String, enum: VIDEO_RESOLUTIONS, default: null })
  resolution?: VideoResolution | null;

  @Prop({ type: String, default: null })
  videoCodec?: string | null;

  @Prop({ type: String, default: null })
  audioCodec?: string | null;

  @Prop({ type: Number, default: null })
  bitrateKbps?: number | null;

  @Prop({ default: 0 })
  sizeBytes!: number;

  @Prop({ type: Array, default: [] })
  videoStreams!: ProbeVideoStream[];

  @Prop({ type: Array, default: [] })
  audioTracks!: ProbeAudioTrack[];

  @Prop({ type: Array, default: [] })
  subtitleTracks!: ProbeSubtitleTrack[];
}

export const LibraryProbeEmbedSchema = SchemaFactory.createForClass(LibraryProbeEmbed);

@Schema({
  timestamps: true,
  collection: 'library_items',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.libraryId = String(ret.libraryId);
      if (ret.movieId) ret.movieId = String(ret.movieId);
      if (ret.seriesId) ret.seriesId = String(ret.seriesId);
      if (ret.seasonId) ret.seasonId = String(ret.seasonId);
      if (ret.episodeId) ret.episodeId = String(ret.episodeId);
      delete ret._id;
      delete ret.relativePath;
      return ret;
    },
  },
})
export class LibraryItem {
  @Prop({ type: Types.ObjectId, ref: 'MediaLibrary', required: true, index: true })
  libraryId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  storageKey!: string;

  @Prop({ required: true, trim: true, maxlength: 1024 })
  relativePath!: string;

  @Prop({ type: String, enum: LIBRARY_FILE_KINDS, required: true, index: true })
  fileKind!: LibraryFileKind;

  @Prop({ type: String, default: null, index: true })
  contentHash?: string | null;

  @Prop({ default: 0, min: 0 })
  sizeBytes!: number;

  @Prop({ default: 0, min: 0 })
  mtimeMs!: number;

  @Prop({ type: String, enum: LIBRARY_ITEM_STATUSES, default: LibraryItemStatus.Processing, index: true })
  status!: LibraryItemStatus;

  @Prop({ type: String, enum: LIBRARY_MATCH_TYPES, default: LibraryMatchType.None, index: true })
  match!: LibraryMatchType;

  @Prop({ type: Types.ObjectId, ref: 'Movie', default: null, index: true })
  movieId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Series', default: null, index: true })
  seriesId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Season', default: null })
  seasonId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Episode', default: null, index: true })
  episodeId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  matchTitle?: string | null;

  @Prop({ type: LibraryProbeEmbedSchema, default: null })
  probe?: LibraryProbeEmbed | null;

  @Prop({ type: String, default: null })
  duplicateOf?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'LibraryScan', default: null, index: true })
  lastScanId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastSeenAt?: Date | null;

  @Prop({ type: Date, default: null })
  missingSince?: Date | null;

  @Prop({ default: false, index: true })
  ignored!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type LibraryItemDocument = HydratedDocument<LibraryItem>;
export const LibraryItemSchema = SchemaFactory.createForClass(LibraryItem);

LibraryItemSchema.index({ libraryId: 1, relativePath: 1 }, { unique: true });
LibraryItemSchema.index({ libraryId: 1, contentHash: 1 }, { unique: true, sparse: true });
LibraryItemSchema.index({ libraryId: 1, status: 1, match: 1 });
LibraryItemSchema.index({ libraryId: 1, lastScanId: 1 });
