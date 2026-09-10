import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CATALOG_TERM_KINDS, CatalogTermKind } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'catalog_terms',
})
export class CatalogTerm {
  @Prop({ type: String, enum: CATALOG_TERM_KINDS, required: true, index: true })
  kind!: CatalogTermKind;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 40 })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 40 })
  name!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CatalogTermDocument = HydratedDocument<CatalogTerm>;
export const CatalogTermSchema = SchemaFactory.createForClass(CatalogTerm);

CatalogTermSchema.index({ kind: 1, slug: 1 }, { unique: true });
CatalogTermSchema.index({ kind: 1, sortOrder: 1, name: 1 });
