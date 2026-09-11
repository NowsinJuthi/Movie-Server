"use client";

import { hasMinimumRole, LibraryKind, UserRole } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { SearchBox } from "@/components/search/search-box";
import { authApi } from "@/lib/auth-api";
import { publicLibraryApi } from "@/lib/public-library-api";
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

  const librariesQuery = useQuery({
    queryKey: ["public-libraries"],
    queryFn: publicLibraryApi.list,
    staleTime: 60_000,
  });

  const libraries = librariesQuery.data?.libraries ?? [];
  const movieLibraries = libraries.filter((library) => library.kind === LibraryKind.Movies);
  const tvLibraries = libraries.filter((library) => library.kind === LibraryKind.Tv);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-3 py-3 transition-colors sm:px-4 md:px-5 lg:px-6",
        scrolled ? "bg-background/95 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      <div className="flex items-center gap-6">
        <button type="button" className="text-xl font-bold text-primary" onClick={() => router.push("/home")}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-7 w-auto max-w-[150px] object-contain" />
          ) : (
            siteName
          )}
        </button>
        <nav className="hidden items-center gap-4 text-sm text-white/80 md:flex">
          <button type="button" className="hover:text-white" onClick={() => router.push("/home")}>
            Home
          </button>
          <NavMenu
            label="Movies"
            items={movieLibraries.map((library) => ({
              id: library.id,
              label: library.name,
              href: `/home/library/${library.id}`,
            }))}
            emptyHint="Add a movie library in Admin → Media libraries"
          />
          {tvLibraries.length > 0 ? (
            <NavMenu
              label="TV Shows"
              items={tvLibraries.map((library) => ({
                id: library.id,
                label: library.name,
                href: `/home/library/${library.id}`,
              }))}
            />
          ) : null}
          <button type="button" className="hover:text-white" onClick={() => router.push("/home/search")}>
            Search
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/home/list")}>
            My List
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/home/favorites")}>
            Favorites
          </button>
          <button type="button" className="hover:text-white" onClick={() => router.push("/home/history")}>
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
        <ProfileMenu
          profile={profile}
          showAdmin={Boolean(user && hasMinimumRole(user.role, UserRole.Admin))}
          onAdmin={() => router.push("/admin")}
          onProfiles={() => router.push("/profiles")}
          onSignOut={async () => {
            await authApi.logout();
            clear();
            clearProfile();
            router.push("/login");
          }}
        />
      </div>
    </header>
  );
}

function ProfileMenu({
  profile,
  showAdmin,
  onAdmin,
  onProfiles,
  onSignOut,
}: {
  profile: PublicProfile;
  showAdmin: boolean;
  onAdmin: () => void;
  onProfiles: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileAvatar profile={profile} size="sm" />
        <span className="hidden text-sm text-white/80 lg:inline">{profile.name}</span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 text-white/70 sm:inline transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 min-w-[12.5rem] pt-2">
          <div className="overflow-hidden rounded-md border border-white/10 bg-zinc-950/95 py-1 shadow-xl backdrop-blur">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate text-sm font-medium text-white">{profile.name}</p>
              <p className="text-xs text-white/50">Profile</p>
            </div>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setOpen(false);
                onProfiles();
              }}
            >
              Switch profile
            </button>
            {showAdmin ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setOpen(false);
                  onAdmin();
                }}
              >
                Admin dashboard
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10 hover:text-white"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await onSignOut();
                } finally {
                  setSigningOut(false);
                  setOpen(false);
                }
              }}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavMenu({
  label,
  items,
  emptyHint,
}: {
  label: string;
  items: Array<{ id: string; label: string; href: string }>;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-white"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 min-w-[12rem] pt-2"
        >
          <div className="rounded-md border border-white/10 bg-zinc-950/95 py-1 shadow-xl backdrop-blur">
            {items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/50">{emptyHint ?? "No libraries yet"}</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
