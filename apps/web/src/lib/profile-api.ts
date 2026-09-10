import type {
  FavoriteItem,
  LibraryTitleCard,
  MediaReaction,
  MediaReactionItem,
  MyListItem,
  PersonalizationMediaKind,
  PersonalizationState,
  PublicProfile,
  RecommendationItem,
  UserRatingItem,
  WatchHistoryEntry,
  WatchProgress,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const profileApi = {
  list: () => apiFetch<{ profiles: PublicProfile[] }>("/profiles"),
  active: () => apiFetch<{ profile: PublicProfile | null }>("/profiles/active"),
  get: (id: string) => apiFetch<{ profile: PublicProfile }>(`/profiles/${id}`),
  create: (input: Record<string, unknown>) =>
    apiFetch<{ profile: PublicProfile }>("/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Record<string, unknown>) =>
    apiFetch<{ profile: PublicProfile }>(`/profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/profiles/${id}`, { method: "DELETE" }),
  select: (id: string, pin?: string) =>
    apiFetch<{ profile: PublicProfile }>(`/profiles/${id}/select`, {
      method: "POST",
      body: JSON.stringify(pin ? { pin } : {}),
    }),
  setPin: (id: string, pin: string, currentPin?: string) =>
    apiFetch<{ profile: PublicProfile }>(`/profiles/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pin, currentPin }),
    }),
  clearPin: (id: string, currentPin: string) =>
    apiFetch<{ profile: PublicProfile }>(`/profiles/${id}/pin`, {
      method: "DELETE",
      body: JSON.stringify({ currentPin }),
    }),
  uploadAvatar: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiFetch<{ profile: PublicProfile }>(`/profiles/${id}/avatar`, {
      method: "POST",
      body,
    });
  },
  deleteAvatar: (id: string) =>
    apiFetch<{ profile: PublicProfile }>(`/profiles/${id}/avatar`, { method: "DELETE" }),
  history: (id: string) => apiFetch<{ items: WatchHistoryEntry[] }>(`/profiles/${id}/history`),
  continueWatching: (id: string) =>
    apiFetch<{ items: WatchProgress[] }>(`/profiles/${id}/continue-watching`),
  upsertHistory: (id: string, input: { mediaId: string; progressSeconds: number; durationSeconds: number }) =>
    apiFetch<{ item: WatchProgress }>(`/profiles/${id}/history`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  clearHistory: (id: string) =>
    apiFetch<{ deleted: number }>(`/profiles/${id}/history`, { method: "DELETE" }),
  removeHistory: (id: string, mediaId: string) =>
    apiFetch<{ message: string }>(`/profiles/${id}/history/${mediaId}`, { method: "DELETE" }),
  myList: (id: string) =>
    apiFetch<{ items: MyListItem[]; titles: LibraryTitleCard[] }>(`/profiles/${id}/list`),
  addToList: (id: string, mediaId: string, kind?: PersonalizationMediaKind) =>
    apiFetch<{ item: MyListItem }>(`/profiles/${id}/list`, {
      method: "POST",
      body: JSON.stringify({ mediaId, kind }),
    }),
  removeFromList: (id: string, mediaId: string) =>
    apiFetch<{ message: string }>(`/profiles/${id}/list/${mediaId}`, { method: "DELETE" }),
  favorites: (id: string) =>
    apiFetch<{ items: FavoriteItem[]; titles: LibraryTitleCard[] }>(`/profiles/${id}/favorites`),
  addFavorite: (id: string, mediaId: string, kind: PersonalizationMediaKind) =>
    apiFetch<{ item: FavoriteItem }>(`/profiles/${id}/favorites`, {
      method: "POST",
      body: JSON.stringify({ mediaId, kind }),
    }),
  removeFavorite: (id: string, mediaId: string) =>
    apiFetch<{ message: string }>(`/profiles/${id}/favorites/${mediaId}`, { method: "DELETE" }),
  reactions: (id: string) => apiFetch<{ items: MediaReactionItem[] }>(`/profiles/${id}/reactions`),
  upsertReaction: (
    id: string,
    input: { mediaId: string; kind: PersonalizationMediaKind; reaction?: MediaReaction | "none" },
  ) =>
    apiFetch<{ item: MediaReactionItem | null }>(`/profiles/${id}/reactions`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  ratings: (id: string) => apiFetch<{ items: UserRatingItem[] }>(`/profiles/${id}/ratings`),
  upsertRating: (
    id: string,
    input: { mediaId: string; kind: PersonalizationMediaKind; rating: number },
  ) =>
    apiFetch<{ item: UserRatingItem }>(`/profiles/${id}/ratings`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  removeRating: (id: string, mediaId: string) =>
    apiFetch<{ message: string }>(`/profiles/${id}/ratings/${mediaId}`, { method: "DELETE" }),
  personalization: (id: string) =>
    apiFetch<PersonalizationState>(`/profiles/${id}/personalization`),
  recommendations: (id: string) =>
    apiFetch<{ items: RecommendationItem[] }>(`/profiles/${id}/recommendations`),
};
