/** Same-origin absolute URL for `<video src>` (Safari is picky about relative stream paths). */
export function toAbsoluteStreamUrl(pathOrUrl: string): string {
  if (typeof window === "undefined") return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).href;
}

/** Append playback query params without breaking an existing `?mt=` token. */
export function appendStreamQuery(
  baseUrl: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  const queryStart = baseUrl.indexOf("?");
  const path = queryStart >= 0 ? baseUrl.slice(0, queryStart) : baseUrl;
  if (queryStart >= 0) {
    const existing = new URLSearchParams(baseUrl.slice(queryStart + 1));
    existing.forEach((value, key) => search.set(key, value));
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `${path}?${encoded}` : path;
}
