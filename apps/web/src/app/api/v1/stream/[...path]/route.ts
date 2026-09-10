import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:4001";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(`${API}/api/v1/stream/${path.map(encodeURIComponent).join("/")}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const range = req.headers.get("range");
  if (range) headers.set("range", range);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

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
