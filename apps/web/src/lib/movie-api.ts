import type {
  AdminMediaAsset,
  AdminMovieDetailResponse,
  BulkMovieAction,
  MovieCatalogResponse,
  MovieContinueItem,
  MovieDetailResponse,
  MovieListResponse,
  MoviePlaybackResponse,
  MovieProgressResponse,
  PublicMovie,
  PublicMovieCollection,
  VideoQuality,
} from "@movie-server/shared";
import { apiFetch } from "./api";
import { playbackDevicePayload } from "./device";
import {
  hevcDirectStreamForPlayback,
  requiresMobileVideoTranscode,
} from "./device-playback";

export type MovieQuery = {
  q?: string;
  genre?: string;
  tag?: string;
  year?: number;
  collection?: string;
  featured?: boolean;
  trending?: boolean;
  popular?: boolean;
  published?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
};

function qs(query: MovieQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || value === null) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const movieApi = {
  list: (query: MovieQuery = {}) => apiFetch<MovieListResponse>(`/movies${qs(query)}`),
  catalog: () => apiFetch<MovieCatalogResponse>("/movies/catalog"),
  continueWatching: () => apiFetch<{ items: MovieContinueItem[] }>("/movies/continue-watching"),
  one: (id: string) => apiFetch<MovieDetailResponse>(`/movies/${id}`),
  playback: (
    id: string,
    quality: VideoQuality,
    options?: { forceVideoTranscode?: boolean },
  ) =>
    apiFetch<MoviePlaybackResponse>(`/movies/${id}/playback`, {
      method: "POST",
      body: JSON.stringify({
        quality,
        hevcDirectStream:
          options?.forceVideoTranscode || requiresMobileVideoTranscode()
          ? false
          : hevcDirectStreamForPlayback(),
        forceVideoTranscode:
          Boolean(options?.forceVideoTranscode) || requiresMobileVideoTranscode(),
        ...playbackDevicePayload(),
      }),
    }),
  progress: (id: string, progressSeconds: number, durationSeconds: number) =>
    apiFetch<MovieProgressResponse>(`/movies/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify({ progressSeconds, durationSeconds }),
    }),
  markWatched: (id: string) =>
    apiFetch<MovieProgressResponse>(`/movies/${id}/watched`, { method: "POST" }),
  markUnwatched: (id: string) =>
    apiFetch<MovieProgressResponse>(`/movies/${id}/watched`, { method: "DELETE" }),
  collections: () => apiFetch<{ collections: PublicMovieCollection[] }>("/collections"),
  collection: (id: string) =>
    apiFetch<{ collection: PublicMovieCollection; movies: PublicMovie[] }>(`/collections/${id}`),
  adminList: (query: MovieQuery = {}) => apiFetch<MovieListResponse>(`/admin/movies${qs(query)}`),
  adminOne: (id: string) => apiFetch<AdminMovieDetailResponse>(`/admin/movies/${id}`),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ movie: PublicMovie }>("/admin/movies", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Record<string, unknown>) =>
    apiFetch<{ movie: PublicMovie }>(`/admin/movies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  applyFromTmdb: (id: string, tmdbId: number, updateArtwork = true) =>
    apiFetch<{ movie: PublicMovie }>(`/admin/movies/${id}/from-tmdb`, {
      method: "POST",
      body: JSON.stringify({ tmdbId, updateArtwork }),
    }),
  remove: (id: string) => apiFetch<{ deleted: boolean }>(`/admin/movies/${id}`, { method: "DELETE" }),
  bulk: (ids: string[], action: BulkMovieAction) =>
    apiFetch<{ matched: number; action: BulkMovieAction }>("/admin/movies/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),
  addMedia: (movieId: string, input: Record<string, unknown>) =>
    apiFetch<{ asset: AdminMediaAsset }>(`/admin/movies/${movieId}/media`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMedia: (movieId: string, assetId: string, input: Record<string, unknown>) =>
    apiFetch<{ asset: AdminMediaAsset }>(`/admin/movies/${movieId}/media/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeMedia: (movieId: string, assetId: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/movies/${movieId}/media/${assetId}`, { method: "DELETE" }),
  uploadArtwork: async (movieId: string, slot: "poster" | "backdrop", file: File) => {
    const body = new FormData();
    body.set("slot", slot);
    body.set("file", file);
    return apiFetch<{ movie: PublicMovie }>(`/admin/movies/${movieId}/artwork`, {
      method: "POST",
      body,
    });
  },
  adminCollections: () => apiFetch<{ collections: PublicMovieCollection[] }>("/admin/collections"),
  createCollection: (input: Record<string, unknown>) =>
    apiFetch<{ collection: PublicMovieCollection }>("/admin/collections", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCollection: (id: string, input: Record<string, unknown>) =>
    apiFetch<{ collection: PublicMovieCollection }>(`/admin/collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeCollection: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/collections/${id}`, { method: "DELETE" }),
};
