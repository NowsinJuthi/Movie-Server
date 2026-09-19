import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import type { AdminDashboard, AdminHealth } from '@movie-server/shared';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Profile, ProfileDocument } from '../profiles/schemas/profile.schema';
import { Movie, MovieDocument } from '../movies/schemas/movie.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';
import { Season, SeasonDocument } from '../series/schemas/season.schema';
import { Episode, EpisodeDocument } from '../series/schemas/episode.schema';
import { Subscription, SubscriptionDocument } from '../subscriptions/schemas/subscription.schema';
import { Payment, PaymentDocument } from '../billing/schemas/payment.schema';
import { MediaLibrary } from '../library/schemas/media-library.schema';
import { LibraryItem } from '../library/schemas/library-item.schema';
import { LibraryScan, LibraryScanDocument } from '../library/schemas/library-scan.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { RedisService } from '../redis/redis.service';
import { PlaybackSessionStore } from '../stream/playback-session.store';
import { LibraryItemStatus, LibraryScanStatus, PaymentStatus, SubscriptionStatus, UserRole } from '@movie-server/shared';
import { MovieUploadRequestsService } from '../movie-upload-requests/movie-upload-requests.service';
import { SiteSettingsService } from '../settings/site-settings.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => PlaybackSessionStore)) private readonly streams: PlaybackSessionStore,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Profile.name) private readonly profiles: Model<ProfileDocument>,
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(Series.name) private readonly series: Model<SeriesDocument>,
    @InjectModel(Season.name) private readonly seasons: Model<SeasonDocument>,
    @InjectModel(Episode.name) private readonly episodes: Model<EpisodeDocument>,
    @InjectModel(Subscription.name) private readonly subscriptions: Model<SubscriptionDocument>,
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    @InjectModel(MediaLibrary.name) private readonly libraries: Model<MediaLibrary>,
    @InjectModel(LibraryItem.name) private readonly items: Model<LibraryItem>,
    @InjectModel(LibraryScan.name) private readonly scans: Model<LibraryScanDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    private readonly movieUploadRequests: MovieUploadRequestsService,
    private readonly siteSettings: SiteSettingsService,
  ) {}

  async dashboard(): Promise<AdminDashboard> {
    const [
      totalUsers,
      activeUsers,
      admins,
      profiles,
      movies,
      series,
      seasons,
      episodes,
      activeSubs,
      trialSubs,
      pastDue,
      canceled,
      successfulPayments,
      refunded,
      libraries,
      unmatched,
      missing,
      runningScans,
      lastScan,
      liveSessions,
      liveStreams,
      movieUploadPending,
      movieUploadSettings,
    ] = await Promise.all([
      this.users.countDocuments(),
      this.users.countDocuments({ isActive: true }),
      this.users.countDocuments({ role: { $in: [UserRole.Admin, UserRole.SuperAdmin] } }),
      this.profiles.countDocuments(),
      this.movies.countDocuments(),
      this.series.countDocuments(),
      this.seasons.countDocuments(),
      this.episodes.countDocuments(),
      this.subscriptions.countDocuments({ status: SubscriptionStatus.Active }),
      this.subscriptions.countDocuments({ status: SubscriptionStatus.Trial }),
      this.subscriptions.countDocuments({ status: SubscriptionStatus.Suspended }),
      this.subscriptions.countDocuments({ status: SubscriptionStatus.Cancelled }),
      this.payments.countDocuments({ status: PaymentStatus.Success }),
      this.payments.countDocuments({
        status: { $in: [PaymentStatus.Refunded, PaymentStatus.PartiallyRefunded] },
      }),
      this.libraries.countDocuments(),
      this.items.countDocuments({ status: LibraryItemStatus.Unmatched }),
      this.items.countDocuments({ status: LibraryItemStatus.Missing }),
      this.scans.countDocuments({
        status: { $in: [LibraryScanStatus.Queued, LibraryScanStatus.Running] },
      }),
      this.scans.findOne().sort({ createdAt: -1 }).exec(),
      this.sessions.countDocuments({ revoked: false, expiresAt: { $gt: new Date() } }),
      this.streams.listAllLive().then((rows) => rows.length),
      this.movieUploadRequests.countPending(),
      this.siteSettings.getPublicFeatures(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, admins },
      profiles,
      catalog: { movies, series, seasons, episodes },
      subscriptions: { active: activeSubs, trial: trialSubs, suspended: pastDue, canceled },
      billing: { successfulPayments, refunded },
      library: { libraries, unmatched, missing },
      live: { sessions: liveSessions, streams: liveStreams },
      scans: {
        running: runningScans,
        lastStatus: lastScan?.status ?? null,
        lastCompletedAt: lastScan?.finishedAt?.toISOString() ?? lastScan?.updatedAt?.toISOString() ?? null,
      },
      movieUploadRequests: {
        enabled: movieUploadSettings.movieUploadRequestsEnabled,
        pending: movieUploadPending,
      },
    };
  }

  async health(queueEnabled: boolean): Promise<AdminHealth> {
    const mongoOk = this.mongo.readyState === 1;
    const redisOk = await this.redis.ping();
    return {
      status: mongoOk && redisOk ? 'ok' : 'degraded',
      mongo: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      queues: {
        enabled: queueEnabled,
        names: queueEnabled ? ['library-scan', 'mail', 'recommendations'] : [],
      },
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
