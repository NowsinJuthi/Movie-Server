const STORAGE_KEY = "cv:player-return";

/** Same-app path only — blocks open redirects. */
export function isSafeAppPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}

/** Call right before navigating to a /watch page. */
export function rememberPlayerReturn(path?: string): void {
  if (typeof window === "undefined") return;
  const value = path ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!isSafeAppPath(value)) return;
  if (value.includes("/watch")) return;
  sessionStorage.setItem(STORAGE_KEY, value);
}

export function peekPlayerReturn(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(STORAGE_KEY);
  return isSafeAppPath(value) && !value.includes("/watch") ? value : null;
}

export function clearPlayerReturn(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
