import type {
  AdminMediaAsset,
  BulkEpisodeAction,
  BulkSeriesAction,
  EpisodeDetailResponse,
  EpisodePlaybackResponse,
  EpisodeProgressResponse,
  PublicEpisode,
  PublicSeason,
  PublicSeries,
  PublicSeriesCollection,
  SeasonDetailResponse,
  SeriesCatalogResponse,
  SeriesContinueItem,
  SeriesDetailResponse,
  SeriesListResponse,
  VideoQuality,
} from "@movie-server/shared";
import { apiFetch } from "./api";
import { playbackDevicePayload } from "./device";

export type SeriesQuery = {
  q?: string;
  genre?: string;
  year?: number;
  featured?: boolean;
  trending?: boolean;
  popular?: boolean;
  published?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
};

function qs(query: SeriesQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || value === null) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const seriesApi = {
  list: (query: SeriesQuery = {}) => apiFetch<SeriesListResponse>(`/series${qs(query)}`),
  catalog: () => apiFetch<SeriesCatalogResponse>("/series/catalog"),
  continueWatching: () => apiFetch<{ items: SeriesContinueItem[] }>("/series/continue-watching"),
  collections: () => apiFetch<{ collections: PublicSeriesCollection[] }>("/series/collections"),
  one: (id: string) => apiFetch<SeriesDetailResponse>(`/series/${id}`),
  season: (seriesId: string, seasonId: string) =>
    apiFetch<SeasonDetailResponse>(`/series/${seriesId}/seasons/${seasonId}`),
  episode: (seriesId: string, episodeId: string) =>
    apiFetch<EpisodeDetailResponse>(`/series/${seriesId}/episodes/${episodeId}`),
  progress: (seriesId: string, episodeId: string, progressSeconds: number, durationSeconds: number) =>
    apiFetch<EpisodeProgressResponse>(`/series/${seriesId}/episodes/${episodeId}/progress`, {
      method: "PUT",
      body: JSON.stringify({ progressSeconds, durationSeconds }),
    }),
  markWatched: (seriesId: string, episodeId: string) =>
    apiFetch<EpisodeProgressResponse>(`/series/${seriesId}/episodes/${episodeId}/watched`, { method: "POST" }),
  markUnwatched: (seriesId: string, episodeId: string) =>
    apiFetch<EpisodeProgressResponse>(`/series/${seriesId}/episodes/${episodeId}/watched`, { method: "DELETE" }),
  playback: (seriesId: string, episodeId: string, quality: VideoQuality) =>
    apiFetch<EpisodePlaybackResponse>(`/series/${seriesId}/episodes/${episodeId}/playback`, {
      method: "POST",
      body: JSON.stringify({ quality, ...playbackDevicePayload() }),
    }),
  updateEpisode: (seriesId: string, seasonId: string, episodeId: string, input: Record<string, unknown>) =>
    apiFetch<{ episode: PublicEpisode }>(
      `/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  adminList: (query: SeriesQuery = {}) => apiFetch<SeriesListResponse>(`/admin/series${qs(query)}`),
  adminOne: (id: string) => apiFetch<SeriesDetailResponse>(`/admin/series/${id}`),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ series: PublicSeries }>("/admin/series", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Record<string, unknown>) =>
    apiFetch<{ series: PublicSeries }>(`/admin/series/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/series/${id}`, { method: "DELETE" }),
  bulk: (ids: string[], action: BulkSeriesAction) =>
    apiFetch<{ matched: number; action: BulkSeriesAction }>("/admin/series/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),
  createSeason: (seriesId: string, input: Record<string, unknown>) =>
    apiFetch<{ season: PublicSeason }>(`/admin/series/${seriesId}/seasons`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  adminSeason: (seriesId: string, seasonId: string) =>
    apiFetch<SeasonDetailResponse>(`/admin/series/${seriesId}/seasons/${seasonId}`),
  updateSeason: (seriesId: string, seasonId: string, input: Record<string, unknown>) =>
    apiFetch<{ season: PublicSeason }>(`/admin/series/${seriesId}/seasons/${seasonId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeSeason: (seriesId: string, seasonId: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/series/${seriesId}/seasons/${seasonId}`, { method: "DELETE" }),
  createEpisode: (seriesId: string, seasonId: string, input: Record<string, unknown>) =>
    apiFetch<{ episode: PublicEpisode }>(`/admin/series/${seriesId}/seasons/${seasonId}/episodes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  batchEpisodes: (seriesId: string, seasonId: string, episodes: Record<string, unknown>[]) =>
    apiFetch<{ episodes: PublicEpisode[] }>(`/admin/series/${seriesId}/seasons/${seasonId}/episodes/batch`, {
      method: "POST",
      body: JSON.stringify({ episodes }),
    }),
  bulkEpisodes: (seriesId: string, seasonId: string, ids: string[], action: BulkEpisodeAction) =>
    apiFetch<{ matched: number; action: BulkEpisodeAction }>(
      `/admin/series/${seriesId}/seasons/${seasonId}/episodes/bulk`,
      { method: "POST", body: JSON.stringify({ ids, action }) },
    ),
  addMedia: (seriesId: string, seasonId: string, episodeId: string, input: Record<string, unknown>) =>
    apiFetch<{ asset: AdminMediaAsset }>(
      `/admin/series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/media`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  adminCollections: () => apiFetch<{ collections: PublicSeriesCollection[] }>("/admin/series-collections"),
  createCollection: (input: Record<string, unknown>) =>
    apiFetch<{ collection: PublicSeriesCollection }>("/admin/series-collections", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  removeCollection: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/series-collections/${id}`, { method: "DELETE" }),
};
