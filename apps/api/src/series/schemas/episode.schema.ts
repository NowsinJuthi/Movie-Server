import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MOVIE_AVAILABILITIES, MovieAvailability } from '@movie-server/shared';
import {
  PlaybackMarkersEmbed,
  PlaybackMarkersEmbedSchema,
} from '../../common/schemas/playback-markers.schema';
import { buildEpisodeSearchFields } from '../../common/search-fields';

@Schema({
  timestamps: true,
  collection: 'episodes',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      ret.seriesId = String(ret.seriesId);
      ret.seasonId = String(ret.seasonId);
      delete ret._id;
      delete ret.titleNormalized;
      return ret;
    },
  },
})
export class Episode {
  @Prop({ type: Types.ObjectId, ref: 'Series', required: true, index: true })
  seriesId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Season', required: true, index: true })
  seasonId!: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  seasonNumber!: number;

  @Prop({ required: true, min: 1, max: 500 })
  episodeNumber!: number;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  description!: string;

  @Prop({ type: String, default: null })
  thumbnailUrl?: string | null;

  @Prop({ type: String, default: null })
  thumbnailKey?: string | null;

  @Prop({ required: true, min: 1, max: 600 })
  runtimeMinutes!: number;

  @Prop({ type: Date, default: null })
  airDate?: Date | null;

  @Prop({ default: false, index: true })
  published!: boolean;

  @Prop({ type: String, enum: MOVIE_AVAILABILITIES, default: MovieAvailability.Unavailable })
  availability!: MovieAvailability;

  @Prop({ type: PlaybackMarkersEmbedSchema, default: () => ({}) })
  markers!: PlaybackMarkersEmbed;

  @Prop({ type: String, default: '', lowercase: true, trim: true, index: true })
  titleNormalized!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type EpisodeDocument = HydratedDocument<Episode>;
export const EpisodeSchema = SchemaFactory.createForClass(Episode);

EpisodeSchema.pre('save', function () {
  Object.assign(this, buildEpisodeSearchFields(this.title));
});

EpisodeSchema.index({ seasonId: 1, episodeNumber: 1 }, { unique: true });
EpisodeSchema.index({ seriesId: 1, seasonNumber: 1, episodeNumber: 1 });
EpisodeSchema.index({ seriesId: 1, published: 1, seasonNumber: 1, episodeNumber: 1 });
EpisodeSchema.index({ published: 1, airDate: -1 });
EpisodeSchema.index({ published: 1, titleNormalized: 1 });
EpisodeSchema.index({ seriesId: 1, published: 1, titleNormalized: 1 });
EpisodeSchema.index(
  {
    title: 'text',
    description: 'text',
  },
  {
    name: 'episode_text',
    default_language: 'none',
    weights: { title: 10, description: 1 },
  },
);
EpisodeSchema.index({ thumbnailKey: 1 }, { sparse: true });
