import type { ConfigService } from '@nestjs/config';
import type { StreamDeliveryPolicy } from '@movie-server/shared';

export function streamDeliveryPolicyFromConfig(config: ConfigService): StreamDeliveryPolicy {
  const apiUrl = config.get<string>('API_URL') ?? '';
  let blockPublicApiHost: string | undefined;
  try {
    blockPublicApiHost = new URL(apiUrl).hostname;
  } catch {
    blockPublicApiHost = undefined;
  }

  return {
    streamProxySecret: config.get<string>('STREAM_PROXY_SECRET') || undefined,
    requireStreamProxy: config.get<string>('NODE_ENV') === 'production',
    blockPublicApiHost,
  };
}
