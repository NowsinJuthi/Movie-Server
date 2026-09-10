import { randomBytes } from 'crypto';

const PATH_HINT = /^(?:[a-zA-Z]:[\\/]|\\\\|\/(?:var|etc|home|usr|opt|mnt|root|tmp|storage)(?:\/|$)|file:)/i;

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'movie';
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function newStorageKey(): string {
  return randomBytes(16).toString('hex');
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  if (PATH_HINT.test(value.trim())) {
    return false;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return !isPrivateOrLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') {
    return true;
  }
  if (host === '127.0.0.1' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) {
    return true;
  }
  const match = /^172\.(\d+)\./.exec(host);
  if (match) {
    const octet = Number(match[1]);
    if (octet >= 16 && octet <= 31) {
      return true;
    }
  }
  return false;
}

export function looksLikeFilesystemPath(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return PATH_HINT.test(value.trim()) || value.includes('\\');
}

export function artworkPublicPath(key: string): string {
  return `/api/v1/media/artwork/${key}`;
}

export function isArtworkKey(value: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/i.test(value);
}
