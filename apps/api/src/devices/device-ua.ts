import { DeviceType } from '@movie-server/shared';

export type ParsedUserAgent = {
  type: DeviceType;
  browser: string | null;
  platform: string | null;
  name: string;
};

export function parseUserAgent(userAgent?: string | null): ParsedUserAgent {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return { type: DeviceType.Unknown, browser: null, platform: null, name: 'Unknown device' };
  }
  const lower = ua.toLowerCase();
  const platform = detectPlatform(lower);
  const browser = detectBrowser(ua, lower);
  const type = detectType(lower);
  const name = [browser, platform].filter(Boolean).join(' on ') || ua.slice(0, 48);
  return { type, browser, platform, name };
}

function detectType(lower: string): DeviceType {
  if (/smart-tv|smarttv|appletv|bravia|crkey|aftb|aftm|tizen|webos/.test(lower)) {
    return DeviceType.Tv;
  }
  if (/ipad|tablet|kindle|silk/.test(lower) && !/mobile/.test(lower)) {
    return DeviceType.Tablet;
  }
  if (/iphone|android.+mobile|windows phone|mobile/.test(lower)) {
    return DeviceType.Mobile;
  }
  if (/electron|amarpin-app|cinevault-app|okhttp|dart/.test(lower)) {
    return DeviceType.App;
  }
  if (/windows|macintosh|linux|x11/.test(lower)) {
    return DeviceType.Desktop;
  }
  return DeviceType.Browser;
}

function detectBrowser(ua: string, lower: string): string | null {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/firefox\//i.test(ua) || /fxios\//i.test(ua)) return 'Firefox';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua) || /crios\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome|crios|android/i.test(lower)) return 'Safari';
  return null;
}

function detectPlatform(lower: string): string | null {
  if (/windows nt/.test(lower)) return 'Windows';
  if (/mac os x|macintosh/.test(lower)) return 'macOS';
  if (/iphone|ipad|ipod/.test(lower)) return 'iOS';
  if (/android/.test(lower)) return 'Android';
  if (/cros/.test(lower)) return 'ChromeOS';
  if (/linux/.test(lower)) return 'Linux';
  return null;
}
