import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, UserRole, hasMinimumRole } from "@movie-server/shared";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(AUTH_COOKIE.Access)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIE.Refresh)?.value;
  // Access JWT expires in ~15m; refresh cookie (days) must still count as a session
  // so AuthHydrator can rotate tokens without kicking the user to /login.
  const hasSession = Boolean(accessToken || refreshToken);

  // Legacy /app routes → /home
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/app/, "/home");
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/profiles", request.url));
  }

  if (
    (pathname.startsWith("/home") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/profiles") ||
      pathname.startsWith("/account")) &&
    !hasSession
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && accessToken) {
    const role = roleFromAccessToken(accessToken);
    if (!role || !hasMinimumRole(role, UserRole.Admin)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

function roleFromAccessToken(token?: string): UserRole | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role === UserRole.User || payload.role === UserRole.Admin || payload.role === UserRole.SuperAdmin) {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/home",
    "/home/:path*",
    "/admin",
    "/admin/:path*",
    "/account/:path*",
    "/profiles",
    "/profiles/:path*",
    "/login",
    "/register",
  ],
};
