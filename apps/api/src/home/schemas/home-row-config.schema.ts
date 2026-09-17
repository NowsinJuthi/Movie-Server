import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { HOME_ROW_KINDS, HomeRowKind } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'home_row_configs',
})
export class HomeRowConfig {
  @Prop({ required: true, trim: true, maxlength: 80 })
  title!: string;

  @Prop({ type: String, enum: HOME_ROW_KINDS, required: true })
  kind!: HomeRowKind;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ default: false })
  shuffleItems!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: String, default: null, maxlength: 40 })
  genre?: string | null;

  @Prop({ type: String, default: null, maxlength: 32 })
  collectionId?: string | null;

  @Prop({ type: String, default: null, maxlength: 32 })
  libraryId?: string | null;

  @Prop({ type: [String], default: [] })
  itemIds!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type HomeRowConfigDocument = HydratedDocument<HomeRowConfig>;
export const HomeRowConfigSchema = SchemaFactory.createForClass(HomeRowConfig);

HomeRowConfigSchema.index({ enabled: 1, sortOrder: 1 });
