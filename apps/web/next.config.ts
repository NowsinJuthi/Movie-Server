import type { NextConfig } from "next";

function apiConnectOrigins(): string {
  const apiPublic = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const origins = new Set<string>(["'self'", "ws:", "wss:"]);
  if (apiPublic.startsWith("http")) {
    try {
      const origin = new URL(apiPublic).origin;
      origins.add(origin);
      origins.add(origin.replace(/^http/i, "ws"));
    } catch {
      /* ignore */
    }
  }
  // Production split-domain fallback when NEXT_PUBLIC is not baked at build time.
  origins.add("https://movies.api.amarpin.com");
  origins.add("wss://movies.api.amarpin.com");
  return [...origins].join(" ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src ${apiConnectOrigins()}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@movie-server/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/app", destination: "/home", permanent: false },
      { source: "/app/:path*", destination: "/home/:path*", permanent: false },
    ];
  },
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${api}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
