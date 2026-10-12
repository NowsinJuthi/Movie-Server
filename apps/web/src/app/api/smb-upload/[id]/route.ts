import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Large Samba uploads can take a long time (network + disk copy). */
export const maxDuration = 3600;

const API = (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Streams multipart uploads to the Nest API without going through the /api/v1 rewrite
 * (Next.js buffers rewrite bodies to 10MB by default).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return jsonError("Server id is required.", 400);
    }

    const body = req.body;
    if (!body) {
      return jsonError("Empty upload body.", 400);
    }

    const target = `${API}/api/v1/admin/smb-servers/${encodeURIComponent(id)}/upload${req.nextUrl.search}`;

    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    const contentLength = req.headers.get("content-length");
    const cookie = req.headers.get("cookie");
    const authorization = req.headers.get("authorization");
    const requestId = req.headers.get("x-request-id");
    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (cookie) headers.set("cookie", cookie);
    if (authorization) headers.set("authorization", authorization);
    if (requestId) headers.set("x-request-id", requestId);

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body,
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Upload proxy failed.";
    return jsonError(
      `Upload proxy failed (${detail}). Check API_INTERNAL_URL and that the API service is running on port 4000.`,
      502,
    );
  }
}
