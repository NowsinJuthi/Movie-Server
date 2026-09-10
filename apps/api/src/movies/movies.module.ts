import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesModule } from '../profiles/profiles.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Movie, MovieSchema } from './schemas/movie.schema';
import { MovieCollection, MovieCollectionSchema } from './schemas/movie-collection.schema';
import { MediaAsset, MediaAssetSchema } from './schemas/media-asset.schema';
import { MoviesService } from './movies.service';
import { CollectionsService } from './collections.service';
import { ArtworkStorageService } from './artwork-storage.service';
import { MoviesController } from './movies.controller';
import { CollectionsController } from './collections.controller';
import { AdminMoviesController } from './admin-movies.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminTracksController } from './admin-tracks.controller';
import { ArtworkController } from './artwork.controller';
import { StreamModule } from '../stream/stream.module';
import { LibraryExclusionModule } from '../library/library-exclusion.module';

@Module({
  imports: [
    ProfilesModule,
    SubscriptionsModule,
    StreamModule,
    LibraryExclusionModule,
    MongooseModule.forFeature([
      { name: Movie.name, schema: MovieSchema },
      { name: MovieCollection.name, schema: MovieCollectionSchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [
    MoviesController,
    CollectionsController,
    AdminMoviesController,
    AdminCollectionsController,
    AdminTracksController,
    ArtworkController,
  ],
  providers: [MoviesService, CollectionsService, ArtworkStorageService],
  exports: [MoviesService, CollectionsService, ArtworkStorageService],
})
export class MoviesModule {}
