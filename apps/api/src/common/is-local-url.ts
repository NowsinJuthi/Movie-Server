export function isLocalUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function isLocalDevOrigin(appUrl?: string, apiUrl?: string): boolean {
  return isLocalUrl(appUrl) || isLocalUrl(apiUrl);
}
