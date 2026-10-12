import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { WatchHistory, WatchHistorySchema } from './schemas/watch-history.schema';
import { MyListItem, MyListItemSchema } from './schemas/my-list.schema';
import { Recommendation, RecommendationSchema } from './schemas/recommendation.schema';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { MediaReactionDoc, MediaReactionSchema } from './schemas/media-reaction.schema';
import { UserRating, UserRatingSchema } from './schemas/user-rating.schema';
import { Movie, MovieSchema } from '../movies/schemas/movie.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
import { Episode, EpisodeSchema } from '../series/schemas/episode.schema';
import { ProfilesService } from './profiles.service';
import { ProfileAccessService } from './profile-access.service';
import { AvatarsService } from './avatars.service';
import { WatchHistoryService } from './watch-history.service';
import { MyListService } from './my-list.service';
import { FavoritesService } from './favorites.service';
import { MediaReactionsService } from './media-reactions.service';
import { UserRatingsService } from './user-ratings.service';
import { RecommendationsService } from './recommendations.service';
import { RecommendationProcessor } from './recommendation.processor';
import { LibraryMediaService } from './library-media.service';
import { ProfilesController } from './profiles.controller';
import { ProfileLibraryController } from './profile-library.controller';
import { AvatarUploadsController } from './avatar-uploads.controller';
import { AdminProfilesController } from './admin-profiles.controller';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { RECOMMENDATION_QUEUE } from '../common/cache-keys';

const useQueue = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';

@Module({
  imports: [
    UsersModule,
    SessionsModule,
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: WatchHistory.name, schema: WatchHistorySchema },
      { name: MyListItem.name, schema: MyListItemSchema },
      { name: Recommendation.name, schema: RecommendationSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: MediaReactionDoc.name, schema: MediaReactionSchema },
      { name: UserRating.name, schema: UserRatingSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Series.name, schema: SeriesSchema },
      { name: Episode.name, schema: EpisodeSchema },
    ]),
    ...(useQueue ? [BullModule.registerQueue({ name: RECOMMENDATION_QUEUE })] : []),
  ],
  controllers: [ProfilesController, ProfileLibraryController, AvatarUploadsController, AdminProfilesController],
  providers: [
    ProfilesService,
    ProfileAccessService,
    AvatarsService,
    WatchHistoryService,
    MyListService,
    FavoritesService,
    MediaReactionsService,
    UserRatingsService,
    RecommendationsService,
    LibraryMediaService,
    ...(useQueue ? [RecommendationProcessor] : []),
  ],
  exports: [
    ProfilesService,
    ProfileAccessService,
    WatchHistoryService,
    MyListService,
    FavoritesService,
    MediaReactionsService,
    UserRatingsService,
    RecommendationsService,
    LibraryMediaService,
  ],
})
export class ProfilesModule {}
