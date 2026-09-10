import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profile.schema';
import { Movie, MovieSchema } from '../movies/schemas/movie.schema';
import { Series, SeriesSchema } from '../series/schemas/series.schema';
import { Season, SeasonSchema } from '../series/schemas/season.schema';
import { Episode, EpisodeSchema } from '../series/schemas/episode.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import { Payment, PaymentSchema } from '../billing/schemas/payment.schema';
import { MediaLibrary, MediaLibrarySchema } from '../library/schemas/media-library.schema';
import { LibraryItem, LibraryItemSchema } from '../library/schemas/library-item.schema';
import { LibraryScan, LibraryScanSchema } from '../library/schemas/library-scan.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { CatalogTerm, CatalogTermSchema } from './schemas/catalog-term.schema';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { CatalogService } from './catalog.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminJobsService } from './admin-jobs.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { StreamModule } from '../stream/stream.module';
import { LIBRARY_SCAN_QUEUE } from '../library/library-scan.service';
import { MAIL_QUEUE } from '../mail/mail.service';
import { RECOMMENDATION_QUEUE } from '../common/cache-keys';

const useQueue = process.env.NODE_ENV !== 'test' && process.env.REDIS_HOST !== 'memory';

@Module({
  imports: [
    forwardRef(() => StreamModule),
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: CatalogTerm.name, schema: CatalogTermSchema },
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Movie.name, schema: MovieSchema },
      { name: Series.name, schema: SeriesSchema },
      { name: Season.name, schema: SeasonSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: MediaLibrary.name, schema: MediaLibrarySchema },
      { name: LibraryItem.name, schema: LibraryItemSchema },
      { name: LibraryScan.name, schema: LibraryScanSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    ...(useQueue
      ? [
          BullModule.registerQueue(
            { name: LIBRARY_SCAN_QUEUE },
            { name: MAIL_QUEUE },
            { name: RECOMMENDATION_QUEUE },
          ),
        ]
      : []),
  ],
  controllers: [AdminDashboardController, AdminAuditController, AdminCatalogController],
  providers: [
    AuditService,
    CatalogService,
    AdminDashboardService,
    AdminJobsService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService, CatalogService],
})
export class AdminModule {}
