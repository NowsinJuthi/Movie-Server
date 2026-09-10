import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LIBRARY_SCAN_STATUSES, LibraryScanStatus } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'library_scans',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.libraryId = ret.libraryId ? String(ret.libraryId) : null;
      delete ret._id;
      return ret;
    },
  },
})
export class LibraryScan {
  @Prop({ type: Types.ObjectId, ref: 'MediaLibrary', default: null, index: true })
  libraryId?: Types.ObjectId | null;

  @Prop({ type: String, enum: LIBRARY_SCAN_STATUSES, default: LibraryScanStatus.Queued, index: true })
  status!: LibraryScanStatus;

  @Prop({ default: false })
  full!: boolean;

  @Prop({ default: 0, min: 0 })
  processed!: number;

  @Prop({ default: 0, min: 0 })
  total!: number;

  @Prop({ default: 0, min: 0 })
  discovered!: number;

  @Prop({ default: 0, min: 0 })
  matched!: number;

  @Prop({ default: 0, min: 0 })
  missing!: number;

  @Prop({ default: 0, min: 0 })
  errorCount!: number;

  @Prop({ default: 0, min: 0 })
  duplicates!: number;

  @Prop({ type: Date, default: null })
  startedAt?: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt?: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type LibraryScanDocument = HydratedDocument<LibraryScan>;
export const LibraryScanSchema = SchemaFactory.createForClass(LibraryScan);

LibraryScanSchema.index({ createdAt: -1 });
LibraryScanSchema.index({ status: 1, createdAt: -1 });
