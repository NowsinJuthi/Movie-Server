import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@movie-server/shared";
import {
  applyStreamProxyHeader,
  assertWebStreamProxyAllowed,
  streamProxyPolicyFromEnv,
} from "@/lib/stream-delivery-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";

type RouteContext = { params: Promise<{ path: string[] }> };

function incomingHeaderBag(req: NextRequest): Record<string, string> {
  const bag: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    bag[key] = value;
  });
  return bag;
}

async function proxy(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    assertWebStreamProxyAllowed(incomingHeaderBag(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: ErrorCode.Forbidden, message }, { status: 403 });
  }

  const proxySecret = streamProxyPolicyFromEnv().streamProxySecret;
  if (!proxySecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: ErrorCode.Forbidden, message: "Stream proxy is not configured." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const target = new URL(`${API}/api/v1/stream/${path.map(encodeURIComponent).join("/")}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  if (proxySecret) {
    applyStreamProxyHeader(headers, proxySecret);
  }
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const userAgent = req.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);
  const referer = req.headers.get("referer");
  if (referer) headers.set("referer", referer);
  const range = req.headers.get("range");
  if (range) headers.set("range", range);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const playbackClient = req.headers.get("x-playback-client");
  if (playbackClient) headers.set("x-playback-client", playbackClient);
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) headers.set("sec-fetch-site", secFetchSite);
  const secFetchMode = req.headers.get("sec-fetch-mode");
  if (secFetchMode) headers.set("sec-fetch-mode", secFetchMode);
  const secFetchDest = req.headers.get("sec-fetch-dest");
  if (secFetchDest) headers.set("sec-fetch-dest", secFetchDest);

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    cache: "no-store",
  });

  const out = new Headers();
  for (const key of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "x-content-type-options",
  ]) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }
  out.set("Cache-Control", "private, no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}

export async function HEAD(req: NextRequest, context: RouteContext) {
  return proxy(req, context);
}
