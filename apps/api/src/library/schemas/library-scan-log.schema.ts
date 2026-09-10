import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LIBRARY_LOG_LEVELS, LibraryLogLevel } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'library_scan_logs',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.scanId = String(ret.scanId);
      delete ret._id;
      return ret;
    },
  },
})
export class LibraryScanLog {
  @Prop({ type: Types.ObjectId, ref: 'LibraryScan', required: true, index: true })
  scanId!: Types.ObjectId;

  @Prop({ type: String, enum: LIBRARY_LOG_LEVELS, required: true, index: true })
  level!: LibraryLogLevel;

  @Prop({ required: true, trim: true, maxlength: 500 })
  message!: string;

  @Prop({ type: String, default: null })
  storageKey?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type LibraryScanLogDocument = HydratedDocument<LibraryScanLog>;
export const LibraryScanLogSchema = SchemaFactory.createForClass(LibraryScanLog);

LibraryScanLogSchema.index({ scanId: 1, createdAt: 1 });
