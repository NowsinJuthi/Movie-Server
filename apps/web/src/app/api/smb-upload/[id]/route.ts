import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large Samba uploads can take a long time (network + disk copy). */
export const maxDuration = 3600;

const API = (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Streams multipart uploads to the Nest API without going through the /api/v1 rewrite
 * (Next.js buffers rewrite bodies to 10MB by default).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const target = `${API}/api/v1/admin/smb-servers/${encodeURIComponent(id)}/upload${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const cookie = req.headers.get("cookie");
  const requestId = req.headers.get("x-request-id");
  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (requestId) headers.set("x-request-id", requestId);

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: req.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const out = new Headers();
  for (const key of ["content-type", "set-cookie"]) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
