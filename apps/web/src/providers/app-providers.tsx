"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ErrorCode } from "@movie-server/shared";
import { AUTH_ROUTES } from "@movie-server/shared";
import { authApi } from "@/lib/auth-api";
import { ApiError, refreshSession } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { BrandingProvider } from "@/components/branding/site-brand";

const SESSION_REFRESH_MS = 10 * 60 * 1000;
const AUTH_BOOT_TIMEOUT_MS = 20_000;

function isTransientAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.statusCode === 502 || error.statusCode === 503 || error.statusCode === 504)
  );
}

async function clearStaleSessionCookies(): Promise<void> {
  try {
    await fetch(`/api/v1${AUTH_ROUTES.Logout}`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* best-effort — invalid cookies may already be cleared by /auth/refresh */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new ApiError({
            statusCode: 504,
            error: ErrorCode.Internal,
            message: "Session check timed out. Refresh the page.",
          }),
        );
      }, ms);
    }),
  ]);
}

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setStatus = useAuthStore((state) => state.setStatus);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;

    const startRefreshLoop = () => {
      if (refreshTimer) return;
      refreshTimer = setInterval(() => {
        void refreshSession()
          .then((data) => {
            if (!cancelled) {
              setUser(data.user);
            }
          })
          .catch(() => undefined);
      }, SESSION_REFRESH_MS);
    };

    const stopRefreshLoop = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
    };

    setStatus("loading");
    withTimeout(authApi.me(), AUTH_BOOT_TIMEOUT_MS)
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          startRefreshLoop();
        }
      })
      .catch(async (error) => {
        if (isTransientAuthError(error)) {
          if (!cancelled) {
            const existing = useAuthStore.getState().user;
            setStatus(existing ? "authenticated" : "anonymous");
          }
          return;
        }
        if (error instanceof ApiError && error.statusCode === 401) {
          try {
            const refreshed = await refreshSession();
            if (!cancelled) {
              setUser(refreshed.user);
              startRefreshLoop();
              return;
            }
          } catch (refreshError) {
            if (isTransientAuthError(refreshError)) {
              if (!cancelled) {
                const existing = useAuthStore.getState().user;
                setStatus(existing ? "authenticated" : "anonymous");
              }
              return;
            }
            await clearStaleSessionCookies();
          }
        }
        // License lock redirect is handled inside apiFetch.
        if (!cancelled) {
          setUser(null);
          useProfileStore.getState().clear();
          stopRefreshLoop();
        }
      })
      .finally(() => {
        if (cancelled) return;
        const state = useAuthStore.getState();
        if (state.status === "loading") {
          setStatus(state.user ? "authenticated" : "anonymous");
        }
      });

    return () => {
      cancelled = true;
      stopRefreshLoop();
    };
  }, [setStatus, setUser]);

  return children;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthHydrator>
        <BrandingProvider>
          {children}
          <Toaster
            theme="dark"
            position="top-center"
            expand
            visibleToasts={4}
            toastOptions={{
              classNames: {
                toast:
                  "group !rounded-2xl !border !border-primary/20 !bg-card/95 !shadow-2xl !backdrop-blur-md",
                title: "!text-sm !font-semibold !text-foreground",
                description: "!text-xs !text-muted-foreground",
                actionButton: "!bg-primary !text-primary-foreground",
                cancelButton: "!bg-secondary !text-secondary-foreground",
              },
            }}
          />
        </BrandingProvider>
      </AuthHydrator>
    </QueryClientProvider>
  );
}
