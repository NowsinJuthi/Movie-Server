import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesModule } from '../profiles/profiles.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MoviesModule } from '../movies/movies.module';
import { MediaAsset, MediaAssetSchema } from '../movies/schemas/media-asset.schema';
import { Series, SeriesSchema } from './schemas/series.schema';
import { SeriesCollection, SeriesCollectionSchema } from './schemas/series-collection.schema';
import { Season, SeasonSchema } from './schemas/season.schema';
import { Episode, EpisodeSchema } from './schemas/episode.schema';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';
import { AdminSeriesController } from './admin-series.controller';
import { AdminSeriesCollectionsController } from './admin-series-collections.controller';
import { SeriesArtworkController } from './series-artwork.controller';
import { StreamModule } from '../stream/stream.module';
import { LibraryExclusionModule } from '../library/library-exclusion.module';

@Module({
  imports: [
    ProfilesModule,
    SubscriptionsModule,
    MoviesModule,
    StreamModule,
    LibraryExclusionModule,
    MongooseModule.forFeature([
      { name: Series.name, schema: SeriesSchema },
      { name: SeriesCollection.name, schema: SeriesCollectionSchema },
      { name: Season.name, schema: SeasonSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [
    SeriesArtworkController,
    SeriesController,
    AdminSeriesController,
    AdminSeriesCollectionsController,
  ],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
