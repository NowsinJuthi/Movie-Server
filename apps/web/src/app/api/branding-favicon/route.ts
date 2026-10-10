import { NextRequest, NextResponse } from "next/server";
import { fetchCustomFaviconBytes, faviconResponse } from "@/lib/branding-favicon-fetch";

export const dynamic = "force-dynamic";
export const revalidate = 30;

/** Serves uploaded favicon for /favicon.ico rewrite (browser default request). */
export async function GET(request: NextRequest) {
  const custom = await fetchCustomFaviconBytes();
  if (custom) {
    return faviconResponse(custom.body, custom.contentType);
  }
  return NextResponse.redirect(new URL("/icon", request.url), 302);
}
