import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoviesModule } from '../movies/movies.module';
import { SeriesModule } from '../series/series.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { Movie, MovieSchema } from '../movies/schemas/movie.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
import { Episode, EpisodeSchema } from '../series/schemas/episode.schema';
import { MediaAsset, MediaAssetSchema } from '../movies/schemas/media-asset.schema';
import { SearchHistory, SearchHistorySchema } from './schemas/search-history.schema';
import { SearchTrend, SearchTrendSchema } from './schemas/search-trend.schema';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchHistoryController } from './search-history.controller';

@Module({
  imports: [
    MoviesModule,
    SeriesModule,
    ProfilesModule,
    MongooseModule.forFeature([
      { name: Movie.name, schema: MovieSchema },
      { name: Series.name, schema: SeriesSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
      { name: SearchHistory.name, schema: SearchHistorySchema },
      { name: SearchTrend.name, schema: SearchTrendSchema },
    ]),
  ],
  controllers: [SearchController, SearchHistoryController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
