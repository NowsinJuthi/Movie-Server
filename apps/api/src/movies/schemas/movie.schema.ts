import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  MATURITY_LEVELS,
  MOVIE_AVAILABILITIES,
  MOVIE_CERTIFICATIONS,
  MaturityLevel,
  MovieAvailability,
  MovieCertification,
} from '@movie-server/shared';
import {
  PlaybackMarkersEmbed,
  PlaybackMarkersEmbedSchema,
} from '../../common/schemas/playback-markers.schema';
import { buildMediaSearchFields } from '../../common/search-fields';

@Schema({ _id: false })
export class CastMember {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 80 })
  character?: string | null;

  @Prop({ default: 0, min: 0, max: 200 })
  order!: number;

  @Prop({ type: String, default: null, maxlength: 500 })
  imageUrl?: string | null;
}

export const CastMemberSchema = SchemaFactory.createForClass(CastMember);

@Schema({ _id: false })
export class MovieRatingsEmbed {
  @Prop({ type: Number, default: null, min: 0, max: 10 })
  imdb?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 10 })
  tmdb?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 100 })
  critics?: number | null;

  @Prop({ type: Number, default: null, min: 0, max: 100 })
  audience?: number | null;
}

export const MovieRatingsSchema = SchemaFactory.createForClass(MovieRatingsEmbed);

@Schema({
  timestamps: true,
  collection: 'movies',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      if (ret.collectionId) ret.collectionId = String(ret.collectionId);
      delete ret._id;
      delete ret.titleNormalized;
      delete ret.originalTitleNormalized;
      delete ret.peopleNormalized;
      return ret;
    },
  },
})
export class Movie {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 120 })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 200, index: true })
  title!: string;

  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  originalTitle?: string | null;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  description!: string;

  @Prop({ type: String, default: null })
  posterUrl?: string | null;

  @Prop({ type: String, default: null })
  backdropUrl?: string | null;

  @Prop({ type: String, default: null })
  posterKey?: string | null;

  @Prop({ type: String, default: null })
  backdropKey?: string | null;

  @Prop({ type: String, default: null })
  trailerUrl?: string | null;

  @Prop({ required: true, min: 1888, max: 2100, index: true })
  releaseYear!: number;

  @Prop({ required: true, min: 1, max: 600 })
  runtimeMinutes!: number;

  @Prop({ type: [String], default: [] })
  genres!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [CastMemberSchema], default: [] })
  cast!: CastMember[];

  @Prop({ type: [String], default: [] })
  directors!: string[];

  @Prop({ type: [String], default: [] })
  writers!: string[];

  @Prop({ type: MovieRatingsSchema, default: () => ({}) })
  ratings!: MovieRatingsEmbed;

  @Prop({ type: String, enum: MATURITY_LEVELS, required: true, index: true })
  maturityRating!: MaturityLevel;

  @Prop({ type: String, enum: MOVIE_CERTIFICATIONS, default: null })
  certification?: MovieCertification | null;

  @Prop({ type: Types.ObjectId, ref: 'MovieCollection', default: null, index: true })
  collectionId?: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  featured!: boolean;

  @Prop({ default: false, index: true })
  trending!: boolean;

  @Prop({ default: false, index: true })
  popular!: boolean;

  @Prop({ default: false, index: true })
  published!: boolean;

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null;

  @Prop({ type: String, enum: MOVIE_AVAILABILITIES, default: MovieAvailability.Unavailable })
  availability!: MovieAvailability;

  @Prop({ type: PlaybackMarkersEmbedSchema, default: () => ({}) })
  markers!: PlaybackMarkersEmbed;

  @Prop({ type: String, default: '', lowercase: true, trim: true, index: true })
  titleNormalized!: string;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  originalTitleNormalized?: string | null;

  @Prop({ type: [String], default: [] })
  peopleNormalized!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type MovieDocument = HydratedDocument<Movie>;
export const MovieSchema = SchemaFactory.createForClass(Movie);

MovieSchema.pre('save', function () {
  Object.assign(this, buildMediaSearchFields(this));
});

MovieSchema.index(
  {
    title: 'text',
    originalTitle: 'text',
    description: 'text',
    tags: 'text',
    genres: 'text',
    directors: 'text',
    writers: 'text',
    'cast.name': 'text',
  },
  {
    name: 'movie_text',
    default_language: 'none',
    weights: {
      title: 10,
      originalTitle: 8,
      'cast.name': 6,
      directors: 6,
      writers: 4,
      tags: 5,
      genres: 5,
      description: 1,
    },
  },
);
MovieSchema.index({ published: 1, featured: -1, createdAt: -1 });
MovieSchema.index({ published: 1, trending: -1, createdAt: -1 });
MovieSchema.index({ published: 1, popular: -1, createdAt: -1 });
MovieSchema.index({ published: 1, releaseYear: -1 });
MovieSchema.index({ published: 1, genres: 1, releaseYear: -1 });
MovieSchema.index({ published: 1, maturityRating: 1 });
MovieSchema.index({ published: 1, availability: 1 });
MovieSchema.index({ published: 1, titleNormalized: 1 });
MovieSchema.index({ published: 1, originalTitleNormalized: 1 });
MovieSchema.index({ published: 1, peopleNormalized: 1 });
MovieSchema.index({ published: 1, 'ratings.imdb': -1, createdAt: -1 });
MovieSchema.index({ published: 1, 'ratings.tmdb': -1, createdAt: -1 });
MovieSchema.index({ published: 1, popular: -1, trending: -1, featured: -1, createdAt: -1 });
MovieSchema.index({ collectionId: 1, published: 1, title: 1 });
MovieSchema.index({ posterKey: 1 }, { sparse: true });
MovieSchema.index({ backdropKey: 1 }, { sparse: true });
MovieSchema.index({ tags: 1 });
