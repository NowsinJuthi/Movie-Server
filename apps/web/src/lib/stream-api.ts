import type { PlaybackSessionInfo } from "@movie-server/shared";
import { apiFetch } from "./api";

export const streamApi = {
  heartbeat: (sessionId: string) =>
    apiFetch<{ session: PlaybackSessionInfo }>(`/stream/${sessionId}/heartbeat`, { method: "POST" }),
  stop: (sessionId: string) =>
    apiFetch<{ stopped: boolean }>(`/stream/${sessionId}`, { method: "DELETE" }),
  selectTracks: (sessionId: string, input: { audioId?: string; subtitleId?: string | null }) =>
    apiFetch<{ session: PlaybackSessionInfo }>(`/stream/${sessionId}/tracks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  seekHls: (sessionId: string, seconds: number, quality?: string) =>
    apiFetch<{ ok: boolean; seconds: number }>(`/stream/${sessionId}/seek`, {
      method: "POST",
      body: JSON.stringify({ seconds, quality }),
    }),
};
