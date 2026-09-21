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

  const requireProxy = (config.get<string>('STREAM_DELIVERY_REQUIRE_PROXY') ?? '').toLowerCase();
  return {
    streamProxySecret: config.get<string>('STREAM_PROXY_SECRET') || undefined,
    // Opt-in: strict proxy-only mode (needs nginx stream → Next + web env secret).
    requireStreamProxy: ['1', 'true', 'yes', 'on'].includes(requireProxy),
    blockPublicApiHost,
  };
}
