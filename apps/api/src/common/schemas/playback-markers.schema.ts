import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class PlaybackMarkersEmbed {
  @Prop({ type: Number, default: null, min: 0, max: 86400 })
  introStartSeconds?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 86400 })
  introEndSeconds?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 86400 })
  recapStartSeconds?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 86400 })
  recapEndSeconds?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 86400 })
  creditsStartSeconds?: number | null;
}

export const PlaybackMarkersEmbedSchema = SchemaFactory.createForClass(PlaybackMarkersEmbed);
