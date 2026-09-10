import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { HomeMediaKind } from '@movie-server/shared';

@Schema({
  timestamps: true,
  collection: 'home_heroes',
})
export class HomeHero {
  @Prop({ required: true, unique: true, default: 'default' })
  key!: string;

  @Prop({ default: false })
  enabled!: boolean;

  @Prop({ type: String, default: null, maxlength: 16 })
  mediaKind?: HomeMediaKind | null;

  @Prop({ type: String, default: null, maxlength: 32 })
  mediaId?: string | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  titleOverride?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type HomeHeroDocument = HydratedDocument<HomeHero>;
export const HomeHeroSchema = SchemaFactory.createForClass(HomeHero);
