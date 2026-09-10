import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesModule } from '../profiles/profiles.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DevicesModule } from '../devices/devices.module';
import { MediaAsset, MediaAssetSchema } from '../movies/schemas/media-asset.schema';
import { Movie, MovieSchema } from '../movies/schemas/movie.schema';
import { LibraryItem, LibraryItemSchema } from '../library/schemas/library-item.schema';
import { MediaLibrary, MediaLibrarySchema } from '../library/schemas/media-library.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
import { Episode, EpisodeSchema } from '../series/schemas/episode.schema';
import { PlaybackRecord, PlaybackRecordSchema } from './schemas/playback-record.schema';
import { StorageFactory } from '../library/storage/storage.factory';
import { PlaybackSessionStore } from './playback-session.store';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { FfmpegRemuxService } from './ffmpeg-remux.service';

@Module({
  imports: [
    ProfilesModule,
    SubscriptionsModule,
    forwardRef(() => DevicesModule),
    MongooseModule.forFeature([
      { name: MediaAsset.name, schema: MediaAssetSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Series.name, schema: SeriesSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: LibraryItem.name, schema: LibraryItemSchema },
      { name: MediaLibrary.name, schema: MediaLibrarySchema },
      { name: PlaybackRecord.name, schema: PlaybackRecordSchema },
    ]),
  ],
  controllers: [StreamController],
  providers: [PlaybackSessionStore, StreamService, StorageFactory, FfmpegRemuxService],
  exports: [StreamService, PlaybackSessionStore],
})
export class StreamModule {}
