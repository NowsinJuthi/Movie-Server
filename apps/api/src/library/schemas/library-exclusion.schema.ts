import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'library_exclusions',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      if (ret.libraryId) ret.libraryId = String(ret.libraryId);
      delete ret._id;
      return ret;
    },
  },
})
export class LibraryExclusion {
  @Prop({ type: Types.ObjectId, ref: 'MediaLibrary', default: null, index: true })
  libraryId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, index: true })
  contentHash?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 1024, index: true })
  relativePath?: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 120, index: true })
  titleSlug?: string | null;

  @Prop({ type: Number, default: null })
  releaseYear?: number | null;

  @Prop({ type: String, default: 'catalog-delete', trim: true, maxlength: 80 })
  reason!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type LibraryExclusionDocument = HydratedDocument<LibraryExclusion>;
export const LibraryExclusionSchema = SchemaFactory.createForClass(LibraryExclusion);

LibraryExclusionSchema.index(
  { libraryId: 1, contentHash: 1 },
  { unique: true, sparse: true, partialFilterExpression: { contentHash: { $type: 'string' } } },
);
LibraryExclusionSchema.index(
  { libraryId: 1, relativePath: 1 },
  { unique: true, sparse: true, partialFilterExpression: { relativePath: { $type: 'string' } } },
);
