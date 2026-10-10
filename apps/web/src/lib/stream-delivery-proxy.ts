import { STREAM_PROXY_HEADER, type StreamDeliveryPolicy } from "@movie-server/shared";

export function streamProxyPolicyFromEnv(): StreamDeliveryPolicy {
  return {
    streamProxySecret: process.env.STREAM_PROXY_SECRET || undefined,
    requireStreamProxy: false,
  };
}

export function applyStreamProxyHeader(headers: Headers, secret: string): void {
  headers.set(STREAM_PROXY_HEADER, secret);
}
