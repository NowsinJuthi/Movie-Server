import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Movie, MovieSchema } from '../movies/schemas/movie.schema';
import { MediaAsset, MediaAssetSchema } from '../movies/schemas/media-asset.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
import { Season, SeasonSchema } from '../series/schemas/season.schema';
import { Episode, EpisodeSchema } from '../series/schemas/episode.schema';
import { MediaLibrary, MediaLibrarySchema } from './schemas/media-library.schema';
import { LibraryItem, LibraryItemSchema } from './schemas/library-item.schema';
import { LibraryScan, LibraryScanSchema } from './schemas/library-scan.schema';
import { LibraryScanLog, LibraryScanLogSchema } from './schemas/library-scan-log.schema';
import { LibraryService } from './library.service';
import { LibraryScanService, LIBRARY_SCAN_QUEUE } from './library-scan.service';
import { LibraryScanProcessor } from './library-scan.processor';
import { LibraryMatcher } from './matching/library-matcher';
import { MediaProbeService } from './probe/media-probe.service';
import { StorageFactory } from './storage/storage.factory';
import { AdminLibraryScanController, AdminLibraryController } from './admin-library.controller';
import { PublicLibraryController } from './public-library.controller';
import { MoviesModule } from '../movies/movies.module';
import { SeriesModule } from '../series/series.module';
import { StreamModule } from '../stream/stream.module';
import { LibraryImportService } from './library-import.service';
import { TmdbMetadataService } from './metadata/tmdb-metadata.service';
import { LibraryExclusionModule } from './library-exclusion.module';
import { LibraryExclusion, LibraryExclusionSchema } from './schemas/library-exclusion.schema';
import { LibraryExclusionService } from './library-exclusion.service';
import { SmbServer, SmbServerSchema } from './smb/schemas/smb-server.schema';
import { SmbCredentialCrypto } from './smb/smb-credential.crypto';
import { SmbClientService } from './smb/smb-client.service';
import { SmbMountService } from './smb/smb-mount.service';
import { SmbService } from './smb/smb.service';
import { AdminSmbController } from './smb/admin-smb.controller';

@Module({})
export class LibraryModule {
  static register(): DynamicModule {
    const useQueue = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';
    return {
      module: LibraryModule,
      imports: [
        MongooseModule.forFeature([
          { name: MediaLibrary.name, schema: MediaLibrarySchema },
          { name: LibraryItem.name, schema: LibraryItemSchema },
          { name: LibraryScan.name, schema: LibraryScanSchema },
          { name: LibraryScanLog.name, schema: LibraryScanLogSchema },
          { name: Movie.name, schema: MovieSchema },
          { name: MediaAsset.name, schema: MediaAssetSchema },
          { name: Series.name, schema: SeriesSchema },
          { name: Season.name, schema: SeasonSchema },
          { name: Episode.name, schema: EpisodeSchema },
          { name: LibraryExclusion.name, schema: LibraryExclusionSchema },
          { name: SmbServer.name, schema: SmbServerSchema },
        ]),
        MoviesModule,
        SeriesModule,
        StreamModule,
        LibraryExclusionModule,
        ...(useQueue ? [BullModule.registerQueue({ name: LIBRARY_SCAN_QUEUE })] : []),
      ],
      controllers: [AdminLibraryScanController, AdminLibraryController, AdminSmbController, PublicLibraryController],
      providers: [
        LibraryService,
        LibraryScanService,
        LibraryImportService,
        TmdbMetadataService,
        LibraryExclusionService,
        LibraryMatcher,
        MediaProbeService,
        StorageFactory,
        SmbCredentialCrypto,
        SmbClientService,
        SmbMountService,
        SmbService,
        ...(useQueue ? [LibraryScanProcessor] : []),
      ],
      exports: [
        LibraryService,
        LibraryScanService,
        StorageFactory,
        MediaProbeService,
        LibraryExclusionService,
        SmbService,
      ],
    };
  }
}
