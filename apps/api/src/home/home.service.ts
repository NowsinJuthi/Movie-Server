import { Injectable } from '@nestjs/common';
import {
  HomeRowKind,
  HomeRowSource,
  MovieSort,
  SeriesSort,
  type HomeCard,
  type HomeResponse,
  type HomeRow,
  type SubscriptionEntitlement,
} from '@movie-server/shared';
import { RequestUser } from '../auth/auth.types';
import { MoviesService } from '../movies/movies.service';
import { SeriesService } from '../series/series.service';
import { MyListService } from '../profiles/my-list.service';
import { FavoritesService } from '../profiles/favorites.service';
import { RecommendationsService } from '../profiles/recommendations.service';
import { WatchHistoryService } from '../profiles/watch-history.service';
import { ProfilesService } from '../profiles/profiles.service';
import { RedisService } from '../redis/redis.service';
import { HomeCmsService } from './home-cms.service';
import { homeCacheKey } from '../common/cache-keys';
import {
  dedupeCards,
  genreDisplayName,
  homeRow,
  movieContinueToCard,
  movieToHomeCard,
  seriesContinueToCard,
  seriesToHomeCard,
} from './home-card.util';

const CACHE_MS = 30_000;
const ROW_LIMIT = 18;

@Injectable()
export class HomeService {
  constructor(
    private readonly movies: MoviesService,
    private readonly series: SeriesService,
    private readonly profiles: ProfilesService,
    private readonly myList: MyListService,
    private readonly favorites: FavoritesService,
    private readonly recommendations: RecommendationsService,
    private readonly history: WatchHistoryService,
    private readonly redis: RedisService,
    private readonly cms: HomeCmsService,
  ) {}

  async get(user: RequestUser, entitlement: SubscriptionEntitlement | null): Promise<HomeResponse> {
    let profileId = user.activeProfileId;
    if (!profileId) {
      const restored = await this.profiles.getActive(user.id, user.sessionId);
      profileId = restored?.id ?? null;
    }
    if (!profileId) {
      return { hero: null, slider: [], rows: [], myListIds: [], favoriteIds: [] };
    }
    user.activeProfileId = profileId;
    const layoutVersion = await this.cms.layoutVersion();
    const cached = await this.redis.client.get(homeCacheKey(profileId, layoutVersion));
    if (cached) {
      return JSON.parse(cached) as HomeResponse;
    }

    const viewer = await this.movies.resolveViewer(user);
    const listOptions = { admin: false as const, ...viewer, entitlement };
    const seriesOptions = { admin: false as const, ...viewer };

    const [
      movieCatalog,
      seriesCatalog,
      movieContinue,
      seriesContinue,
      listItems,
      favoriteItems,
      recItems,
      historyItems,
      newMovies,
      newSeries,
    ] = await Promise.all([
      this.movies.catalog(viewer, entitlement),
      this.series.catalog(viewer),
      this.movies.continueWatching(user),
      this.series.continueWatching(user),
      this.myList.list(user.id, profileId),
      this.favorites.list(user.id, profileId),
      this.recommendations.list(user.id, profileId),
      this.history.list(user.id, profileId),
      this.movies.list({ sort: MovieSort.Year, limit: ROW_LIMIT, page: 1 }, listOptions),
      this.series.list({ sort: SeriesSort.Year, limit: ROW_LIMIT, page: 1 }, seriesOptions),
    ]);

    const myListIds = listItems.map((item) => item.mediaId);
    const favoriteIds = favoriteItems.map((item) => item.mediaId);
    const myList = new Set(myListIds);

    const continueCards = [
      ...movieContinue.items.map((item) => movieContinueToCard(item, myList)),
      ...seriesContinue.items.map((item) => seriesContinueToCard(item, myList)),
    ];

    const movieCards = (items: typeof movieCatalog.featured) => items.map((item) => movieToHomeCard(item, myList));
    const seriesCards = (items: typeof seriesCatalog.featured) => items.map((item) => seriesToHomeCard(item, myList));

    const featured = [...movieCards(movieCatalog.featured), ...seriesCards(seriesCatalog.featured)];
    const trending = [...movieCards(movieCatalog.trending), ...seriesCards(seriesCatalog.trending)];
    const popularMovies = movieCards(movieCatalog.popular);
    const popularSeries = seriesCards(seriesCatalog.popular);
    const recentlyAdded = [...movieCards(movieCatalog.newest), ...seriesCards(seriesCatalog.newest)];
    const newReleases = [...movieCards(newMovies.items), ...seriesCards(newSeries.items)];

    const progressById = new Map(
      historyItems.map((item) => [
        item.mediaId,
        { progressSeconds: item.progressSeconds, durationSeconds: item.durationSeconds },
      ]),
    );
    const recentlyWatched = await this.hydrateIds(
      historyItems.map((item) => item.mediaId),
      viewer,
      entitlement,
      myList,
      progressById,
    );
    const hydratedList = await this.hydrateIds(myListIds, viewer, entitlement, myList);
    const hydratedFavorites = await this.hydrateIds(favoriteIds, viewer, entitlement, myList);
    const recIds = recItems.map((item) => item.mediaId);
    const hydratedRecs = await this.hydrateIds(recIds, viewer, entitlement, myList);
    const recommended = hydratedRecs.length
      ? hydratedRecs
      : this.fallbackRecommended(featured, trending, recentlyAdded, continueCards);

    const catalogPool = dedupeCards([
      ...featured,
      ...trending,
      ...popularMovies,
      ...popularSeries,
      ...recentlyAdded,
      ...newReleases,
    ]);
    const affinityCards = dedupeCards([...continueCards, ...recentlyWatched, ...hydratedFavorites, ...hydratedList]);
    const genreRows = await this.genreRows(affinityCards.length ? affinityCards : catalogPool, viewer, entitlement, myList);
    const because = this.becauseYouWatched(affinityCards.length ? affinityCards : continueCards, catalogPool);

    const collectionRows: HomeRow[] = [
      ...movieCatalog.collections.map((row) =>
        homeRow(
          `movie-collection-${row.collection.id}`,
          row.collection.name,
          HomeRowKind.Collection,
          HomeRowSource.Admin,
          movieCards(row.movies),
        ),
      ),
      ...seriesCatalog.collections.map((row) =>
        homeRow(
          `series-collection-${row.collection.id}`,
          row.collection.name,
          HomeRowKind.Collection,
          HomeRowSource.Admin,
          seriesCards(row.series),
        ),
      ),
    ].filter((row): row is HomeRow => Boolean(row));

    let rows = [
      homeRow(
        'recently-watched',
        'Recently Watched',
        HomeRowKind.RecentlyWatched,
        HomeRowSource.Personalized,
        recentlyWatched,
      ),
      homeRow('featured', 'Featured', HomeRowKind.Featured, HomeRowSource.Admin, featured),
      homeRow('trending', 'Trending Now', HomeRowKind.Trending, HomeRowSource.Admin, trending),
      homeRow('popular-movies', 'Popular Movies', HomeRowKind.PopularMovies, HomeRowSource.Catalog, popularMovies),
      homeRow('popular-series', 'Popular TV Series', HomeRowKind.PopularSeries, HomeRowSource.Catalog, popularSeries),
      homeRow('recommended', 'Recommended for You', HomeRowKind.Recommended, HomeRowSource.Personalized, recommended),
      homeRow('recent', 'Recently Added', HomeRowKind.RecentlyAdded, HomeRowSource.Catalog, recentlyAdded),
      homeRow('new-releases', 'New Releases', HomeRowKind.NewReleases, HomeRowSource.Catalog, newReleases),
      because,
      ...genreRows,
      ...collectionRows,
    ].filter((row): row is HomeRow => Boolean(row));

    let hero =
      featured.find((item) => item.backdropUrl) ??
      trending.find((item) => item.backdropUrl) ??
      featured[0] ??
      trending[0] ??
      recentlyAdded[0] ??
      null;
    let slider: HomeCard[] = hero ? [hero] : [];

    const [cmsHero, cmsRows] = await Promise.all([this.cms.findHero(), this.cms.listEnabledRows()]);
    if (cmsHero?.enabled) {
      const ids =
        cmsHero.itemIds?.length > 0
          ? cmsHero.itemIds.slice(0, 6)
          : cmsHero.mediaId
            ? [cmsHero.mediaId]
            : [];
      if (ids.length) {
        const cards = await this.hydrateIds(ids, viewer, entitlement, myList);
        if (cards.length) {
          slider = cards.map((card, index) =>
            index === 0 && cmsHero.titleOverride ? { ...card, title: cmsHero.titleOverride } : card,
          );
          hero = slider[0] ?? null;
        }
      }
    }

    if (cmsRows.length > 0) {
      const built = await Promise.all(
        cmsRows.map(async (cfg) => {
          const items = await this.cmsRowItems(cfg.kind, {
            featured,
            trending,
            popularMovies,
            popularSeries,
            recentlyAdded,
            newReleases,
            collectionRows,
            continueCards,
            hydratedList,
            hydratedFavorites,
            recommended,
            recentlyWatched,
            genre: cfg.genre,
            collectionId: cfg.collectionId,
            itemIds: cfg.itemIds,
            viewer,
            entitlement,
            myList,
          });
          return homeRow(`cms-${String(cfg._id)}`, cfg.title, cfg.kind, HomeRowSource.Admin, items);
        }),
      );
      const personalized = rows.filter((row) => row?.source === HomeRowSource.Personalized);
      const usedKinds = new Set(cmsRows.map((cfg) => cfg.kind));
      const leftover = rows.filter(
        (row) => row && row.source !== HomeRowSource.Personalized && !usedKinds.has(row.kind),
      );
      rows = [...personalized, ...built, ...leftover].filter((row): row is HomeRow => Boolean(row));
    }

    const payload: HomeResponse = { hero, slider, rows, myListIds, favoriteIds };
    await this.redis.client.set(homeCacheKey(profileId, layoutVersion), JSON.stringify(payload), 'PX', CACHE_MS);
    return payload;
  }

  private async hydrateIds(
    ids: string[],
    viewer: { maturity: import('@movie-server/shared').MaturityLevel; isKids: boolean },
    entitlement: SubscriptionEntitlement | null,
    myList: Set<string>,
    progressById?: Map<string, { progressSeconds: number; durationSeconds: number }>,
  ): Promise<HomeCard[]> {
    if (ids.length === 0) {
      return [];
    }
    const movies = await this.movies.publicByIds(ids, viewer, entitlement);
    const movieIds = new Set(movies.map((item) => item.id));
    const remaining = ids.filter((id) => !movieIds.has(id));
    const series = remaining.length ? await this.series.publicByIds(remaining, viewer) : [];
    const seriesIds = new Set(series.map((item) => item.id));
    const leftover = remaining.filter((id) => !seriesIds.has(id));
    const fromEpisodes = leftover.length ? await this.series.seriesFromEpisodeIds(leftover, viewer) : [];

    const movieMap = new Map(movies.map((item) => [item.id, movieToHomeCard(item, myList)]));
    const seriesMap = new Map(series.map((item) => [item.id, seriesToHomeCard(item, myList)]));
    const episodeMap = new Map(
      fromEpisodes.map((item) => [
        item.episodeId,
        seriesToHomeCard(item.series, myList, {
          episodeLabel: `S${item.seasonNumber}:E${item.episodeNumber} ${item.episodeTitle}`,
        }),
      ]),
    );

    return ids
      .map((id) => {
        const card = movieMap.get(id) ?? seriesMap.get(id) ?? episodeMap.get(id) ?? null;
        if (!card) {
          return null;
        }
        const progress = progressById?.get(id);
        if (!progress || progress.durationSeconds <= 0) {
          return card;
        }
        return {
          ...card,
          progressRatio: Math.min(1, Math.max(0, progress.progressSeconds / progress.durationSeconds)),
        };
      })
      .filter((item): item is HomeCard => Boolean(item));
  }

  private fallbackRecommended(featured: HomeCard[], trending: HomeCard[], recent: HomeCard[], continueCards: HomeCard[]): HomeCard[] {
    const watched = new Set(continueCards.map((item) => item.id));
    return dedupeCards([...trending, ...featured, ...recent]).filter((item) => !watched.has(item.id));
  }

  private becauseYouWatched(continueCards: HomeCard[], pool: HomeCard[]): HomeRow | null {
    const seed = continueCards.find((item) => item.genres.length > 0);
    if (!seed) {
      return null;
    }
    const genre = seed.genres[0];
    const items = pool.filter((item) => item.id !== seed.id && item.genres.includes(genre));
    return homeRow(
      `because-${seed.id}`,
      `Because you watched ${seed.title}`,
      HomeRowKind.BecauseYouWatched,
      HomeRowSource.Personalized,
      items,
    );
  }

  private async genreRows(
    pool: HomeCard[],
    viewer: { maturity: import('@movie-server/shared').MaturityLevel; isKids: boolean },
    entitlement: SubscriptionEntitlement | null,
    myList: Set<string>,
  ): Promise<HomeRow[]> {
    const counts = new Map<string, number>();
    for (const item of pool) {
      for (const genre of item.genres) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .filter(([, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre]) => genre);
    if (top.length === 0) {
      return [];
    }

    const fetched = await Promise.all(
      top.map(async (genre) => {
        const [movies, series] = await Promise.all([
          this.movies.list(
            { genre, sort: MovieSort.Featured, limit: ROW_LIMIT, page: 1 },
            { admin: false, ...viewer, entitlement },
          ),
          this.series.list({ genre, sort: SeriesSort.Featured, limit: ROW_LIMIT, page: 1 }, { admin: false, ...viewer }),
        ]);
        return homeRow(
          `genre-${genre}`,
          genreDisplayName(genre),
          HomeRowKind.Genre,
          HomeRowSource.Catalog,
          [...movies.items.map((item) => movieToHomeCard(item, myList)), ...series.items.map((item) => seriesToHomeCard(item, myList))],
        );
      }),
    );
    return fetched.filter((row): row is HomeRow => Boolean(row));
  }

  private async cmsRowItems(
    kind: HomeRowKind,
    ctx: {
      featured: HomeCard[];
      trending: HomeCard[];
      popularMovies: HomeCard[];
      popularSeries: HomeCard[];
      recentlyAdded: HomeCard[];
      newReleases: HomeCard[];
      collectionRows: HomeRow[];
      continueCards: HomeCard[];
      hydratedList: HomeCard[];
      hydratedFavorites: HomeCard[];
      recommended: HomeCard[];
      recentlyWatched: HomeCard[];
      genre?: string | null;
      collectionId?: string | null;
      itemIds: string[];
      viewer: { maturity: import('@movie-server/shared').MaturityLevel; isKids: boolean };
      entitlement: SubscriptionEntitlement | null;
      myList: Set<string>;
    },
  ): Promise<HomeCard[]> {
    switch (kind) {
      case HomeRowKind.Featured:
        return ctx.featured;
      case HomeRowKind.Trending:
        return ctx.trending;
      case HomeRowKind.PopularMovies:
        return ctx.popularMovies;
      case HomeRowKind.PopularSeries:
        return ctx.popularSeries;
      case HomeRowKind.RecentlyAdded:
        return ctx.recentlyAdded;
      case HomeRowKind.NewReleases:
        return ctx.newReleases;
      case HomeRowKind.Continue:
        return ctx.continueCards;
      case HomeRowKind.MyList:
        return ctx.hydratedList;
      case HomeRowKind.Favorites:
        return ctx.hydratedFavorites;
      case HomeRowKind.Recommended:
        return ctx.recommended;
      case HomeRowKind.RecentlyWatched:
        return ctx.recentlyWatched;
      case HomeRowKind.Manual:
        return this.hydrateIds(ctx.itemIds.slice(0, ROW_LIMIT), ctx.viewer, ctx.entitlement, ctx.myList);
      case HomeRowKind.Genre: {
        if (!ctx.genre) return [];
        const [movies, series] = await Promise.all([
          this.movies.list(
            { genre: ctx.genre, sort: MovieSort.Featured, limit: ROW_LIMIT, page: 1 },
            { admin: false, ...ctx.viewer, entitlement: ctx.entitlement },
          ),
          this.series.list(
            { genre: ctx.genre, sort: SeriesSort.Featured, limit: ROW_LIMIT, page: 1 },
            { admin: false, ...ctx.viewer },
          ),
        ]);
        return [
          ...movies.items.map((item) => movieToHomeCard(item, ctx.myList)),
          ...series.items.map((item) => seriesToHomeCard(item, ctx.myList)),
        ];
      }
      case HomeRowKind.Collection: {
        if (!ctx.collectionId) return ctx.collectionRows[0]?.items ?? [];
        const match = ctx.collectionRows.find((row) => row.id.includes(ctx.collectionId!));
        return match?.items ?? [];
      }
      default:
        return [];
    }
  }
}
