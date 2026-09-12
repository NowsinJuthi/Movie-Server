"use client";

import {
  hasMinimumRole,
  LibraryKind,
  UserRole,
  type PublicProfile,
} from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { SearchBox } from "@/components/search/search-box";
import { useBranding } from "@/components/branding/site-brand";
import { authApi } from "@/lib/auth-api";
import { publicLibraryApi } from "@/lib/public-library-api";
import { brandingAssetSrc } from "@/lib/settings-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { cn } from "@/lib/utils";

export function AppHeader({
  profile,
  planLabel,
  scrolled = true,
  variant = "browse",
}: {
  profile?: PublicProfile | null;
  planLabel?: string | null;
  scrolled?: boolean;
  /** browse = Netflix-style; admin = solid bar over admin pages */
  variant?: "browse" | "admin";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clear } = useAuthStore();
  const clearProfile = useProfileStore((state) => state.clear);
  const storeProfile = useProfileStore((state) => state.activeProfile);
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);
  const isAdmin = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  const activeProfile = profile ?? storeProfile;
  const onAdminRoute = pathname?.startsWith("/admin") ?? false;

  const librariesQuery = useQuery({
    queryKey: ["public-libraries"],
    queryFn: publicLibraryApi.list,
    staleTime: 60_000,
  });

  const libraries = librariesQuery.data?.libraries ?? [];
  const movieLibraries = libraries.filter((library) => library.kind === LibraryKind.Movies);
  const tvLibraries = libraries.filter((library) => library.kind === LibraryKind.Tv);

  const solid = variant === "admin" || scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-colors sm:px-4 md:px-5 lg:px-6",
        solid ? "border-b border-white/10 bg-background/95 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      <div className="flex min-w-0 items-center justify-self-start">
        <button
          type="button"
          className="shrink-0 text-xl font-bold text-primary"
          onClick={() => router.push("/home")}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-9 w-auto max-w-[180px] object-contain sm:h-10 sm:max-w-[200px]" />
          ) : (
            <>
              {siteName}
              {variant === "admin" ? (
                <span className="ml-1.5 text-sm font-semibold text-white/55">Admin</span>
              ) : null}
            </>
          )}
        </button>
      </div>

      <nav className="hidden items-center justify-center gap-3 justify-self-center text-sm text-white/80 lg:flex xl:gap-4">
        <HeaderLink href="/home" active={pathname === "/home"}>
          Home
        </HeaderLink>
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
      </nav>

      <div className="flex shrink-0 items-center justify-end gap-1.5 justify-self-end sm:gap-2 md:gap-3">
        <Suspense
          fallback={
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/70" />
          }
        >
          <SearchBox />
        </Suspense>
        {planLabel && !/^staff$/i.test(planLabel) ? (
          <Button
            variant="ghost"
            className="hidden md:inline-flex"
            onClick={() => router.push("/account/subscription")}
          >
            {planLabel}
          </Button>
        ) : null}
        <AccountMenu
          profile={activeProfile}
          displayName={user?.displayName}
          email={user?.email}
          isAdmin={isAdmin}
          onAdminRoute={onAdminRoute}
          onHome={() => router.push("/home")}
          onAdmin={() => router.push("/admin")}
          onProfiles={() => router.push("/profiles")}
          onDevices={() => router.push("/account/devices")}
          onSettings={() => router.push("/account/settings")}
          onMyList={() => router.push("/home/list")}
          onFavorites={() => router.push("/home/favorites")}
          onHistory={() => router.push("/home/history")}
          onSubscription={() => router.push("/account/subscription")}
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

/** @deprecated Prefer AppHeader — kept for existing browse imports. */
export function BrowseHeader(props: {
  profile: PublicProfile;
  planLabel?: string | null;
  scrolled: boolean;
}) {
  return <AppHeader {...props} variant="browse" />;
}

function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn("hover:text-white", active && "font-semibold text-white")}
      onClick={() => router.push(href)}
    >
      {children}
    </button>
  );
}

function AccountMenu({
  profile,
  displayName,
  email,
  isAdmin,
  onAdminRoute,
  onHome,
  onAdmin,
  onProfiles,
  onDevices,
  onSettings,
  onMyList,
  onFavorites,
  onHistory,
  onSubscription,
  onSignOut,
}: {
  profile?: PublicProfile | null;
  displayName?: string | null;
  email?: string;
  isAdmin: boolean;
  onAdminRoute: boolean;
  onHome: () => void;
  onAdmin: () => void;
  onProfiles: () => void;
  onDevices: () => void;
  onSettings: () => void;
  onMyList: () => void;
  onFavorites: () => void;
  onHistory: () => void;
  onSubscription: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const accountLabel = displayName?.trim() || email || "Account";
  const accountInitial = (displayName?.trim() || email || "A").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
        className="flex min-h-11 min-w-11 touch-manipulation items-center gap-2 rounded-lg outline-none ring-offset-background transition hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        {profile ? (
          <ProfileAvatar profile={profile} size="sm" />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
            {accountInitial}
          </span>
        )}
        <span className="hidden max-w-[8rem] truncate text-sm text-foreground/85 lg:inline">
          {accountLabel}
        </span>
        <ChevronDown
          className={cn("hidden h-3.5 w-3.5 text-muted-foreground transition sm:inline", open && "rotate-180 text-primary")}
        />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 min-w-[14rem] pt-2">
          <div className="overflow-hidden rounded-xl border border-border bg-card/95 py-1.5 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.75)] ring-1 ring-primary/15 backdrop-blur-md">
            <div className="border-b border-border bg-secondary/50 px-3.5 py-3">
              <p className="truncate text-sm font-semibold text-foreground">{accountLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {profile?.name
                  ? `Watching as ${profile.name}`
                  : isAdmin
                    ? "Admin"
                    : "Signed in"}
              </p>
            </div>
            <div className="py-1">
              {profile ? (
                <MenuItem
                  onClick={() => {
                    setOpen(false);
                    onProfiles();
                  }}
                >
                  Switch profile
                </MenuItem>
              ) : null}
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onMyList();
                }}
              >
                My List
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onFavorites();
                }}
              >
                Favorites
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onHistory();
                }}
              >
                History
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onDevices();
                }}
              >
                Devices
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onSettings();
                }}
              >
                Account settings
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onSubscription();
                }}
              >
                Subscription
              </MenuItem>
            </div>
            {isAdmin ? (
              <div className="border-t border-border py-1">
                {onAdminRoute ? (
                  <MenuItem
                    onClick={() => {
                      setOpen(false);
                      onHome();
                    }}
                  >
                    Browse home
                  </MenuItem>
                ) : (
                  <MenuItem
                    accent
                    onClick={() => {
                      setOpen(false);
                      onAdmin();
                    }}
                  >
                    Admin Dashboard
                  </MenuItem>
                )}
              </div>
            ) : null}
            <div className="border-t border-border py-1">
              <MenuItem
                danger
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
              </MenuItem>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  accent,
  danger,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "block w-full px-3.5 py-3 text-left text-sm transition-colors disabled:opacity-60",
        accent
          ? "font-medium text-primary hover:bg-primary/15"
          : danger
            ? "text-destructive hover:bg-destructive/10"
            : "text-foreground/85 hover:bg-secondary hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NavMenu({
  label,
  items,
  emptyHint,
  active,
}: {
  label: string;
  items: Array<{ id: string; label: string; href: string }>;
  emptyHint?: string;
  active?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
        className={cn("inline-flex items-center gap-1 hover:text-white", active && "font-semibold text-white")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-50 min-w-[12.5rem] pt-2">
          <div className="overflow-hidden rounded-xl border border-border bg-card/95 py-1.5 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.75)] ring-1 ring-primary/15 backdrop-blur-md">
            {items.length === 0 ? (
              <p className="px-3.5 py-2 text-xs text-muted-foreground">{emptyHint ?? "No libraries yet"}</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="block w-full px-3.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary hover:text-foreground"
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
