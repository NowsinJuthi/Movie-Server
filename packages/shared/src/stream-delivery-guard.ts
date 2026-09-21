import { PLAYBACK_CLIENT_HEADER, PLAYBACK_CLIENT_VALUE } from './playback';

/** Server-only header: Next.js stream proxy → Nest API (never exposed to browsers). */
export const STREAM_PROXY_HEADER = 'X-AmarPin-Stream-Proxy';

export const STREAM_DELIVERY_FORBIDDEN_MESSAGE =
  'Playback is only available in the AmarPin player.';

const DOWNLOAD_TOOL_UA =
  /internet download manager|\bidm\b|fdm[\/.]|free download manager|wget\/|curl\/|libcurl|aria2|uget\/|motrix|jdownloader|nxstyle|ffmpeg|streamlink/i;

export type StreamDeliveryPolicy = {
  streamProxySecret?: string;
  /** When true, only the internal proxy header is accepted (production API). */
  requireStreamProxy?: boolean;
  /** Block when Host matches the public API hostname (movies.api.* direct grabs). */
  blockPublicApiHost?: string;
};

export type HeaderBag = Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderBag, name: string): string {
  const direct = headers[name];
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct) && direct[0]) return direct[0];
  const lower = headers[name.toLowerCase()];
  if (typeof lower === 'string') return lower;
  if (Array.isArray(lower) && lower[0]) return lower[0];
  return '';
}

export function isDownloadManagerUserAgent(userAgent: string): boolean {
  return DOWNLOAD_TOOL_UA.test(userAgent);
}

/** Safari / iOS native HLS cannot set custom headers. Windows IDM spoofs Chrome, not Safari. */
export function isAppleNativeHlsUserAgent(userAgent: string): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true;
  }
  return /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/i.test(userAgent);
}

export function isStreamDeliveryAllowed(headers: HeaderBag, policy: StreamDeliveryPolicy): boolean {
  const ua = readHeader(headers, 'user-agent');
  if (isDownloadManagerUserAgent(ua)) {
    return false;
  }

  const host = readHeader(headers, 'host').split(':')[0].toLowerCase();
  if (policy.blockPublicApiHost && host === policy.blockPublicApiHost.toLowerCase()) {
    return false;
  }

  const proxy = readHeader(headers, STREAM_PROXY_HEADER);
  if (policy.streamProxySecret && proxy && proxy === policy.streamProxySecret) {
    return true;
  }

  if (policy.requireStreamProxy) {
    return false;
  }

  const client = readHeader(headers, PLAYBACK_CLIENT_HEADER);
  const site = readHeader(headers, 'sec-fetch-site');
  const dest = readHeader(headers, 'sec-fetch-dest');
  const mode = readHeader(headers, 'sec-fetch-mode');
  const referer = readHeader(headers, 'referer');

  if (
    client === PLAYBACK_CLIENT_VALUE &&
    mode === 'cors' &&
    dest === 'empty' &&
    (site === 'same-origin' || site === 'same-site')
  ) {
    return true;
  }

  // Native HLS on Apple only (playlists + segments). Windows IDM uses Chrome UA.
  if (
    isAppleNativeHlsUserAgent(ua) &&
    (dest === 'video' || dest === 'empty') &&
    (mode === 'no-cors' || mode === 'cors' || !mode) &&
    (site === 'same-origin' || site === 'same-site') &&
    /\/watch(\/|\?|$)/i.test(referer)
  ) {
    return true;
  }

  return false;
}
