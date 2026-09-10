"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { authApi } from "@/lib/auth-api";
import { ApiError, refreshSession } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { BrandingProvider } from "@/components/branding/site-brand";

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setStatus = useAuthStore((state) => state.setStatus);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    authApi
      .me()
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
        }
      })
      .catch(async (error) => {
        if (error instanceof ApiError && error.statusCode === 401) {
          try {
            const refreshed = await refreshSession();
            if (!cancelled) {
              setUser(refreshed.user);
              return;
            }
          } catch {
            /* anonymous */
          }
        }
        // License lock redirect is handled inside apiFetch.
        if (!cancelled) {
          setUser(null);
          useProfileStore.getState().clear();
        }
      });
    return () => {
      cancelled = true;
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
          <Toaster theme="dark" position="top-center" />
        </BrandingProvider>
      </AuthHydrator>
    </QueryClientProvider>
  );
}
