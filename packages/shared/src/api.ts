export const API_PREFIX = 'api/v1';

export const AUTH_COOKIE = {
  Access: 'cv_access',
  Refresh: 'cv_refresh',
} as const;

export const AUTH_ROUTES = {
  Register: '/auth/register',
  Login: '/auth/login',
  Logout: '/auth/logout',
  LogoutAll: '/auth/logout-all',
  Refresh: '/auth/refresh',
  Me: '/auth/me',
  VerifyEmail: '/auth/verify-email',
  ResendVerification: '/auth/resend-verification',
  ForgotPassword: '/auth/forgot-password',
  ResetPassword: '/auth/reset-password',
  ChangePassword: '/auth/change-password',
  Sessions: '/auth/sessions',
  Session: '/auth/sessions/:id',
} as const;

export const ADMIN_ROUTES = {
  Dashboard: '/admin/dashboard',
  Health: '/admin/health',
  Jobs: '/admin/jobs',
  Audit: '/admin/audit',
  Users: '/admin/users',
  User: '/admin/users/:id',
  UserRole: '/admin/users/:id/role',
  Profiles: '/admin/profiles',
  Profile: '/admin/profiles/:id',
  Plans: '/admin/plans',
  Subscriptions: '/admin/subscriptions',
  Payments: '/admin/billing/payments',
  Invoices: '/admin/billing/invoices',
  Movies: '/admin/movies',
  Collections: '/admin/collections',
  Series: '/admin/series',
  SeriesCollections: '/admin/series-collections',
  Libraries: '/admin/libraries',
  LibraryScans: '/admin/libraries/scans',
  Tracks: '/admin/tracks',
  Genres: '/admin/catalog/genres',
  Tags: '/admin/catalog/tags',
  CatalogTerm: '/admin/catalog/:kind/:id',
  HomeHero: '/admin/home/hero',
  HomeRows: '/admin/home/rows',
  HomeRow: '/admin/home/rows/:id',
  Sessions: '/admin/sessions',
  Streams: '/admin/streams',
  RevokeSession: '/admin/sessions/:id',
  RevokeDevice: '/admin/devices/:id',
} as const;

export const BILLING_ROUTES = {
  Checkout: '/billing/checkout',
  Verify: '/billing/checkout/verify',
  History: '/billing/history',
  Invoices: '/billing/invoices',
  Webhook: '/billing/webhooks/:provider',
} as const;

export const PLAN_ROUTES = {
  List: '/plans',
} as const;

export const SUBSCRIPTION_ROUTES = {
  Me: '/subscriptions/me',
  Start: '/subscriptions',
  Change: '/subscriptions/me/change',
  Cancel: '/subscriptions/me/cancel',
  Resume: '/subscriptions/me/resume',
  Renew: '/subscriptions/me/renew',
  History: '/subscriptions/me/history',
  Changes: '/subscriptions/me/changes',
  Entitlement: '/subscriptions/me/entitlement',
} as const;

export const CONTENT_ROUTES = {
  Premium: '/content/premium',
  PlaybackAuth: '/content/playback-auth',
} as const;

export const MOVIE_ROUTES = {
  List: '/movies',
  Catalog: '/movies/catalog',
  ContinueWatching: '/movies/continue-watching',
  One: '/movies/:id',
  Playback: '/movies/:id/playback',
  Progress: '/movies/:id/progress',
  Watched: '/movies/:id/watched',
  Collections: '/collections',
  Collection: '/collections/:id',
} as const;

export const STREAM_ROUTES = {
  Master: '/stream/:sessionId/master',
  Variant: '/stream/:sessionId/v/:quality',
  Media: '/stream/:sessionId/media',
  Audio: '/stream/:sessionId/audio/:assetId',
  Subtitle: '/stream/:sessionId/subtitles/:assetId',
  Tracks: '/stream/:sessionId/tracks',
  Heartbeat: '/stream/:sessionId/heartbeat',
  Stop: '/stream/:sessionId',
  Active: '/stream/active',
} as const;

export const DEVICE_ROUTES = {
  List: '/devices',
  One: '/devices/:id',
} as const;

export const MEDIA_ROUTES = {
  Artwork: '/media/artwork/:key',
} as const;

export const SERIES_ROUTES = {
  List: '/series',
  Catalog: '/series/catalog',
  ContinueWatching: '/series/continue-watching',
  Collections: '/series/collections',
  One: '/series/:id',
  Season: '/series/:id/seasons/:seasonId',
  Episode: '/series/:id/episodes/:episodeId',
  Progress: '/series/:id/episodes/:episodeId/progress',
  Watched: '/series/:id/episodes/:episodeId/watched',
  Playback: '/series/:id/episodes/:episodeId/playback',
  Artwork: '/series/artwork/:key',
} as const;

export const HOME_ROUTES = {
  Browse: '/home',
} as const;

export const LIBRARY_ROUTES = {
  List: '/libraries',
  Browse: '/libraries/:id',
} as const;

export const SEARCH_ROUTES = {
  Query: '/search',
  Suggest: '/search/suggest',
  Trending: '/search/trending',
  SimilarMovie: '/search/similar/movies/:id',
  SimilarSeries: '/search/similar/series/:id',
} as const;

export const PROFILE_ROUTES = {
  List: '/profiles',
  Create: '/profiles',
  Active: '/profiles/active',
  One: '/profiles/:id',
  Select: '/profiles/:id/select',
  Avatar: '/profiles/:id/avatar',
  Pin: '/profiles/:id/pin',
  History: '/profiles/:id/history',
  ContinueWatching: '/profiles/:id/continue-watching',
  MyList: '/profiles/:id/list',
  Favorites: '/profiles/:id/favorites',
  Reactions: '/profiles/:id/reactions',
  Ratings: '/profiles/:id/ratings',
  Recommendations: '/profiles/:id/recommendations',
  Personalization: '/profiles/:id/personalization',
  SearchHistory: '/profiles/:id/search-history',
} as const;
