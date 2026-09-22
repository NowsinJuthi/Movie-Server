/** Server-only header: Next.js stream proxy → Nest API (never exposed to browsers). */
export const STREAM_PROXY_HEADER = 'X-AmarPin-Stream-Proxy';

export type StreamDeliveryPolicy = {
  streamProxySecret?: string;
  /** When true, only the internal proxy header is accepted (production API). */
  requireStreamProxy?: boolean;
};
