import {
  isStreamDeliveryAllowed,
  STREAM_DELIVERY_FORBIDDEN_MESSAGE,
  STREAM_PROXY_HEADER,
  type HeaderBag,
  type StreamDeliveryPolicy,
} from "@movie-server/shared";

export function streamProxyPolicyFromEnv(): StreamDeliveryPolicy {
  return {
    streamProxySecret: process.env.STREAM_PROXY_SECRET || undefined,
    requireStreamProxy: false,
  };
}

export function assertWebStreamProxyAllowed(headers: HeaderBag): void {
  if (isStreamDeliveryAllowed(headers, streamProxyPolicyFromEnv())) {
    return;
  }
  throw new Error(STREAM_DELIVERY_FORBIDDEN_MESSAGE);
}

export function applyStreamProxyHeader(headers: Headers, secret: string): void {
  headers.set(STREAM_PROXY_HEADER, secret);
}
