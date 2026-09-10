"use client";

import { hasMinimumRole, UserRole } from "@movie-server/shared";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { SearchBox } from "@/components/search/search-box";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { cn } from "@/lib/utils";
import type { PublicProfile } from "@movie-server/shared";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";

export function BrowseHeader({
  profile,
  planLabel,
  scrolled,
}: {
  profile: PublicProfile;
  planLabel?: string | null;
  scrolled: boolean;
}) {
  const router = useRouter();
  const { user, clear } = useAuthStore();
  const clearProfile = useProfileStore((state) => state.clear);
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-3 py-3 transition-colors sm:px-4 md:px-5 lg:px-6",
        scrolled ? "bg-background/95 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      <div className="flex items-center gap-6">
        <button type="button" className="text-xl font-bold text-primary" onClick={() => router.push("/app")}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-7 w-auto max-w-[150px] object-contain" />
          ) : (
            siteName
          )}
        </button>
        <nav className="hidden items-center gap-4 text-sm text-white/80 md:flex">
          <button type="button" className="hover:text-white" onClick={() => router.push("/app")}>
            Home
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/app/search")}>
            Search
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/app/list")}>
            My List
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/app/favorites")}>
            Favorites
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/app/history")}>
            History
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <Suspense
          fallback={
            <button type="button" aria-label="Search" className="inline-flex h-10 w-10 items-center justify-center">
              <Search className="h-5 w-5" />
            </button>
          }
        >
          <SearchBox />
        </Suspense>
        <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => router.push("/account/devices")}>
          Devices
        </Button>
        <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => router.push("/account/subscription")}>
          {planLabel ?? "Subscribe"}
        </Button>
        {user && hasMinimumRole(user.role, UserRole.Admin) ? (
          <Button variant="outline" className="hidden md:inline-flex" onClick={() => router.push("/admin")}>
            Admin
          </Button>
        ) : null}
        <button type="button" onClick={() => router.push("/profiles")} className="flex items-center gap-2">
          <ProfileAvatar profile={profile} size="sm" />
          <span className="hidden text-sm text-white/80 lg:inline">{profile.name}</span>
        </button>
        <Button
          variant="secondary"
          className="hidden sm:inline-flex"
          onClick={async () => {
            await authApi.logout();
            clear();
            clearProfile();
            router.push("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
