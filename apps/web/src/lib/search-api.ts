import type {
  SearchHistoryResponse,
  SearchQuery,
  SearchResponse,
  SearchSimilarResponse,
  SearchSuggestResponse,
  SearchTrendingResponse,
} from "@movie-server/shared";
import { apiFetch } from "./api";

function qs(query: SearchQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || value === null || value === false) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const searchApi = {
  query: (input: SearchQuery = {}) => apiFetch<SearchResponse>(`/search${qs(input)}`),
  suggest: (q: string) => apiFetch<SearchSuggestResponse>(`/search/suggest${qs({ q })}`),
  trending: () => apiFetch<SearchTrendingResponse>("/search/trending"),
  similarMovie: (id: string) => apiFetch<SearchSimilarResponse>(`/search/similar/movies/${id}`),
  similarSeries: (id: string) => apiFetch<SearchSimilarResponse>(`/search/similar/series/${id}`),
  history: (profileId: string) => apiFetch<SearchHistoryResponse>(`/profiles/${profileId}/search-history`),
  recordHistory: (profileId: string, query: string, resultCount = 0) =>
    apiFetch<SearchHistoryResponse>(`/profiles/${profileId}/search-history`, {
      method: "POST",
      body: JSON.stringify({ query, resultCount }),
    }),
  clearHistory: (profileId: string) =>
    apiFetch<{ deleted: number }>(`/profiles/${profileId}/search-history`, { method: "DELETE" }),
};
