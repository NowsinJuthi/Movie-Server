import type { PublicBranding } from "@movie-server/shared";

function apiInternalBase(): string {
  return process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
}

export async function loadPublicBrandingServer(): Promise<PublicBranding | null> {
  try {
    const res = await fetch(`${apiInternalBase()}/api/v1/settings/branding`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicBranding;
  } catch {
    return null;
  }
}

/** Favicon bytes from Admin → System settings (when uploaded). */
export async function fetchCustomFaviconBytes(): Promise<{
  body: ArrayBuffer;
  contentType: string;
} | null> {
  const branding = await loadPublicBrandingServer();
  if (!branding?.faviconUrl) {
    return null;
  }
  try {
    const iconRes = await fetch(`${apiInternalBase()}/api/v1/settings/branding/favicon`, {
      cache: "no-store",
    });
    if (!iconRes.ok) {
      return null;
    }
    const body = await iconRes.arrayBuffer();
    const contentType = iconRes.headers.get("content-type") || "image/png";
    return { body, contentType };
  } catch {
    return null;
  }
}

export function faviconResponse(body: ArrayBuffer, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
