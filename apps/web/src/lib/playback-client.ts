import { PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from "@movie-server/shared";

export function playbackClientHeaders(): Record<string, string> {
  return { [PLAYBACK_CLIENT_HEADER]: PLAYBACK_CLIENT_VALUE };
}

export function applyPlaybackClientHeader(xhr: XMLHttpRequest): void {
  xhr.setRequestHeader(PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE);
}
