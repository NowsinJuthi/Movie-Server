import { AUTH_ROUTES, ErrorCode, type ApiErrorBody, type PublicUser } from "@movie-server/shared";

/** Same-origin proxy (aaPanel Nginx /api/v1/ → API :4000). */
const API_BASE = "/api/v1";

const LICENSE_ERROR_CODES = new Set<string>([
  ErrorCode.LicenseRequired,
  ErrorCode.LicenseExpired,
  ErrorCode.LicenseTrialExpired,
]);

function redirectToLicenseIfNeeded(error: ApiError): void {
  if (typeof window === "undefined") return;
  if (!LICENSE_ERROR_CODES.has(error.error)) return;
  if (window.location.pathname.startsWith("/license")) return;
  const next = `${window.location.pathname}${window.location.search}`;
  const target = `/license?next=${encodeURIComponent(next)}`;
  window.location.assign(target);
}

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.statusCode = body.statusCode;
    this.error = body.error;
    this.details = body.details;
  }
}

export type AuthResponse = {
  message?: string;
  user: PublicUser;
};

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError({
      statusCode: body.statusCode ?? res.status,
      error: body.error ?? ErrorCode.Internal,
      message: body.message ?? "Request failed",
      details: body.details,
    });
  } catch {
    const unreachable = res.status === 502 || res.status === 503 || res.status === 504;
    return new ApiError({
      statusCode: res.status,
      error: ErrorCode.Internal,
      message: unreachable
        ? "Cannot reach the API server. Start it with REDIS_HOST=memory and PORT=4000 (npm run dev:api), then retry."
        : `Request failed (HTTP ${res.status}).`,
    });
  }
}

const NO_REFRESH_PATHS = new Set<string>([
  AUTH_ROUTES.Login,
  AUTH_ROUTES.Register,
  AUTH_ROUTES.Refresh,
  AUTH_ROUTES.Logout,
  AUTH_ROUTES.LogoutAll,
  AUTH_ROUTES.ForgotPassword,
  AUTH_ROUTES.ResetPassword,
  AUTH_ROUTES.VerifyEmail,
  AUTH_ROUTES.ResendVerification,
]);

let refreshInFlight: Promise<AuthResponse> | null = null;

/** Single-flight refresh so Strict Mode / multi-tab 401s do not rotate twice and revoke sessions. */
export function refreshSession(): Promise<AuthResponse> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${API_BASE}${AUTH_ROUTES.Refresh}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as AuthResponse;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError({
      statusCode: 503,
      error: ErrorCode.Internal,
      message:
        "Cannot reach the API server. Start it with REDIS_HOST=memory and PORT=4000 (npm run dev:api), then retry.",
    });
  }
}

async function parseOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await parseError(res);
    redirectToLicenseIfNeeded(error);
    throw error;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await rawFetch(path, init);

  if (res.status === 401 && !retried && !NO_REFRESH_PATHS.has(path)) {
    try {
      await refreshSession();
      return apiFetch<T>(path, init, true);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw await parseError(res);
    }
  }

  return parseOk<T>(res);
}
