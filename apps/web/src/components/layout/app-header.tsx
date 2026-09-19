"use client";

import {
  hasMinimumRole,
  LibraryKind,
  UserRole,
  type PublicProfile,
} from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Clapperboard, Film, Home, Menu, Sparkles, Tv, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { SearchBox } from "@/components/search/search-box";
import { useBranding } from "@/components/branding/site-brand";
import { authApi } from "@/lib/auth-api";
import { publicLibraryApi } from "@/lib/public-library-api";
import { movieUploadRequestApi } from "@/lib/movie-upload-request-api";
import { brandingAssetSrc } from "@/lib/settings-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { cn } from "@/lib/utils";
import styles from "./app-header.module.css";

export function AppHeader({
  profile,
  planLabel,
  scrolled = true,
  variant = "browse",
}: {
  profile?: PublicProfile | null;
  planLabel?: string | null;
  scrolled?: boolean;
  /** browse = storefront; admin = solid bar over admin pages */
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

  const featuresQuery = useQuery({
    queryKey: ["site-features"],
    queryFn: movieUploadRequestApi.features,
    staleTime: 30_000,
    enabled: variant === "browse",
  });

  const movieRequestsEnabled = Boolean(featuresQuery.data?.movieUploadRequestsEnabled);
  const requestsNavActive = pathname === "/home/request-movie";

  const libraries = librariesQuery.data?.libraries ?? [];
  const movieLibraries = libraries.filter((library) => library.kind === LibraryKind.Movies);
  const tvLibraries = libraries.filter((library) => library.kind === LibraryKind.Tv);

  const solid = variant === "admin" || scrolled;
  const [browseMenuOpen, setBrowseMenuOpen] = useState(false);

  useEffect(() => {
    setBrowseMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!browseMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [browseMenuOpen]);

  const openMobileMenu = () => {
    setBrowseMenuOpen(true);
  };

  const homeActive = pathname === "/home";
  const discoverActive = pathname === "/home/welcome";
  const activeLibraryId = pathname?.startsWith("/home/library/")
    ? pathname.split("/")[3]
    : null;
  const moviesActive = movieLibraries.some((library) => library.id === activeLibraryId);
  const tvActive = tvLibraries.some((library) => library.id === activeLibraryId);

  const logoButton = (
    <button
      type="button"
      className={styles.logoBtn}
      onClick={() => router.push("/home")}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={siteName} className={styles.logoImg} />
      ) : (
        <>
          {siteName}
          {variant === "admin" ? (
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">Admin</span>
          ) : null}
        </>
      )}
    </button>
  );

  const headerActions = (
    <div className={styles.actions}>
      <Suspense
        fallback={
          <div className={cn(styles.iconBtn, "opacity-70")} aria-hidden />
        }
      >
        <SearchBox triggerClassName={styles.iconBtn} />
      </Suspense>
      {planLabel && variant !== "admin" && !/^staff$/i.test(planLabel) && !/^admin$/i.test(planLabel) ? (
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
  );

  return (
    <>
      <header
        className={cn(
          styles.siteHeader,
          !solid && variant === "browse" && styles.siteHeaderTransparent,
        )}
      >
        <div className={styles.siteHeaderInner}>
          {/* Left — mobile browse menu + logo */}
          <div className="flex min-w-0 items-center gap-1 justify-self-start sm:gap-2">
            {variant === "browse" ? (
              <button
                type="button"
                aria-label="Open browse menu"
                className={cn(styles.iconBtn, styles.mobileMenuBtn, "lg:hidden")}
                onClick={openMobileMenu}
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : null}
            <div className={cn(variant === "admin" ? "block" : "hidden lg:block")}>{logoButton}</div>
          </div>

          {/* Center — mobile browse logo + desktop nav */}
          <div className="flex min-w-0 items-center justify-center justify-self-stretch overflow-visible lg:justify-self-center">
            {variant === "browse" ? (
              <div className={cn(styles.mobileLogoWrap, styles.mobileBrowseLogo)}>{logoButton}</div>
            ) : null}

            {variant === "browse" ? (
              <nav className={styles.desktopNav} aria-label="Main">
                <HeaderLink href="/home" active={homeActive}>
                  Home
                </HeaderLink>
                <HeaderLink href="/home/welcome" active={discoverActive}>
                  Discover
                </HeaderLink>
                <NavMenu
                  label="Movies"
                  active={moviesActive}
                  items={movieLibraries.map((library) => ({
                    id: library.id,
                    label: library.name,
                    href: `/home/library/${library.id}`,
                    active: library.id === activeLibraryId,
                  }))}
                  emptyHint="Add a movie library in Admin → Media libraries"
                  footerItems={
                    movieRequestsEnabled
                      ? [
                          {
                            id: "request-movie",
                            label: "Request a movie",
                            href: "/home/request-movie?kind=movie",
                            icon: Film,
                          },
                        ]
                      : undefined
                  }
                />
                {tvLibraries.length > 0 ? (
                  <NavMenu
                    label="TV Shows"
                    active={tvActive}
                    items={tvLibraries.map((library) => ({
                      id: library.id,
                      label: library.name,
                      href: `/home/library/${library.id}`,
                      active: library.id === activeLibraryId,
                    }))}
                    footerItems={
                      movieRequestsEnabled
                        ? [
                            {
                              id: "request-tv",
                              label: "Request a TV show",
                              href: "/home/request-movie?kind=tv",
                              icon: Tv,
                            },
                          ]
                        : undefined
                    }
                  />
                ) : null}
                {movieRequestsEnabled ? (
                  <NavMenu
                    label="Requests"
                    active={requestsNavActive}
                    items={[]}
                    emptyHint={undefined}
                    footerItems={[
                      {
                        id: "req-movie",
                        label: "Request a movie",
                        href: "/home/request-movie?kind=movie",
                        icon: Film,
                      },
                      {
                        id: "req-tv",
                        label: "Request a TV show",
                        href: "/home/request-movie?kind=tv",
                        icon: Tv,
                      },
                    ]}
                    footerOnly
                  />
                ) : null}
              </nav>
            ) : (
              <p className="hidden text-sm font-semibold text-muted-foreground lg:block">Administration</p>
            )}
          </div>

          {/* Right — actions */}
          <div className="justify-self-end">{headerActions}</div>
        </div>
      </header>

      {variant === "browse" && browseMenuOpen ? (
        <BrowseMobileDrawer
          homeActive={homeActive}
          discoverActive={discoverActive}
          showRequestMenu={movieRequestsEnabled}
          requestsNavActive={requestsNavActive}
          activeLibraryId={activeLibraryId ?? undefined}
          movieLibraries={movieLibraries}
          tvLibraries={tvLibraries}
          onClose={() => setBrowseMenuOpen(false)}
          onNavigate={(href) => {
            setBrowseMenuOpen(false);
            router.push(href);
          }}
        />
      ) : null}
    </>
  );
}

function BrowseMobileDrawer({
  homeActive,
  discoverActive,
  showRequestMenu,
  requestsNavActive,
  activeLibraryId,
  movieLibraries,
  tvLibraries,
  onClose,
  onNavigate,
}: {
  homeActive: boolean;
  discoverActive: boolean;
  showRequestMenu: boolean;
  requestsNavActive: boolean;
  activeLibraryId?: string;
  movieLibraries: Array<{ id: string; name: string }>;
  tvLibraries: Array<{ id: string; name: string }>;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [moviesOpen, setMoviesOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const moviesActive = movieLibraries.some((library) => library.id === activeLibraryId);
  const tvActive = tvLibraries.some((library) => library.id === activeLibraryId);

  return (
    <div className={cn(styles.mobileOverlay, "lg:hidden")} role="dialog" aria-modal="true" aria-label="Browse menu">
      <button type="button" className={styles.mobileBackdrop} aria-label="Close menu" onClick={onClose} />
      <aside className={styles.mobilePanel}>
        <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3">
          <p className="text-base font-semibold text-foreground">Browse</p>
          <button type="button" aria-label="Close" onClick={onClose} className={styles.iconBtn}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className={cn(styles.mobileNavScroll, "brand-scrollbar")} aria-label="Browse libraries">
          <ul className={styles.mobileNavList}>
            <li>
              <MobileNavLink active={homeActive} icon={Home} onClick={() => onNavigate("/home")}>
                Home
              </MobileNavLink>
            </li>
            <li>
              <MobileNavLink
                active={discoverActive}
                icon={Sparkles}
                onClick={() => onNavigate("/home/welcome")}
              >
                Discover
              </MobileNavLink>
            </li>

            {movieLibraries.length > 0 ? (
              <li>
                <MobileNavLink
                  active={moviesActive}
                  icon={Film}
                  chevron
                  expanded={moviesOpen}
                  onClick={() => setMoviesOpen((value) => !value)}
                >
                  Movies
                </MobileNavLink>
                {moviesOpen ? (
                  <ul className={styles.mobileSubmenu}>
                    {movieLibraries.map((library) => (
                      <li key={library.id}>
                        <MobileNavLink
                          active={library.id === activeLibraryId}
                          icon={Film}
                          onClick={() => onNavigate(`/home/library/${library.id}`)}
                        >
                          {library.name}
                        </MobileNavLink>
                      </li>
                    ))}
                    {showRequestMenu ? (
                      <li>
                        <MobileNavLink
                          icon={Clapperboard}
                          onClick={() => onNavigate("/home/request-movie?kind=movie")}
                        >
                          Request a movie
                        </MobileNavLink>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            ) : showRequestMenu ? (
              <li>
                <MobileNavLink
                  icon={Film}
                  onClick={() => onNavigate("/home/request-movie?kind=movie")}
                >
                  Request a movie
                </MobileNavLink>
              </li>
            ) : null}

            {tvLibraries.length > 0 ? (
              <li>
                <MobileNavLink
                  active={tvActive}
                  icon={Tv}
                  chevron
                  expanded={tvOpen}
                  onClick={() => setTvOpen((value) => !value)}
                >
                  TV Shows
                </MobileNavLink>
                {tvOpen ? (
                  <ul className={styles.mobileSubmenu}>
                    {tvLibraries.map((library) => (
                      <li key={library.id}>
                        <MobileNavLink
                          active={library.id === activeLibraryId}
                          icon={Tv}
                          onClick={() => onNavigate(`/home/library/${library.id}`)}
                        >
                          {library.name}
                        </MobileNavLink>
                      </li>
                    ))}
                    {showRequestMenu ? (
                      <li>
                        <MobileNavLink
                          icon={Clapperboard}
                          onClick={() => onNavigate("/home/request-movie?kind=tv")}
                        >
                          Request a TV show
                        </MobileNavLink>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            ) : showRequestMenu ? (
              <li>
                <MobileNavLink
                  icon={Tv}
                  onClick={() => onNavigate("/home/request-movie?kind=tv")}
                >
                  Request a TV show
                </MobileNavLink>
              </li>
            ) : null}

            {showRequestMenu ? (
              <li>
                <MobileNavLink
                  active={requestsNavActive}
                  icon={Clapperboard}
                  chevron
                  expanded={requestsOpen}
                  onClick={() => setRequestsOpen((value) => !value)}
                >
                  Requests
                </MobileNavLink>
                {requestsOpen ? (
                  <ul className={styles.mobileSubmenu}>
                    <li>
                      <MobileNavLink
                        icon={Film}
                        onClick={() => onNavigate("/home/request-movie?kind=movie")}
                      >
                        Request a movie
                      </MobileNavLink>
                    </li>
                    <li>
                      <MobileNavLink
                        icon={Tv}
                        onClick={() => onNavigate("/home/request-movie?kind=tv")}
                      >
                        Request a TV show
                      </MobileNavLink>
                    </li>
                  </ul>
                ) : null}
              </li>
            ) : null}
          </ul>

          {movieLibraries.length === 0 && tvLibraries.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No libraries available yet.</p>
          ) : null}
        </nav>
      </aside>
    </div>
  );
}

function MobileNavLink({
  children,
  active,
  icon: Icon,
  chevron,
  expanded,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  icon: typeof Home;
  chevron?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(styles.mobileNavLink, active && styles.mobileNavLinkActive)}
      onClick={onClick}
    >
      {active ? <span className={styles.mobileNavIndicator} aria-hidden /> : null}
      <span className={cn(styles.mobileNavIconBox, active && styles.mobileNavIconBoxActive)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate text-left">{children}</span>
      {chevron ? (
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
          aria-hidden
        />
      ) : null}
    </button>
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
      className={cn(styles.navLink, active && styles.navLinkActive)}
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
        className={styles.accountBtn}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        {profile ? (
          <ProfileAvatar profile={profile} size="sm" />
        ) : (
          <span className={styles.accountAvatar}>{accountInitial}</span>
        )}
        <span className={styles.accountLabel}>{accountLabel}</span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-muted-foreground transition sm:inline",
            open && "rotate-180 text-primary",
          )}
        />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 min-w-[14rem] pt-2">
          <div className={styles.menuPanel}>
            <div className={styles.menuHeader}>
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
        styles.menuItem,
        accent && styles.menuItemAccent,
        danger && styles.menuItemDanger,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type NavFooterItem = {
  id: string;
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

function NavMenu({
  label,
  items,
  emptyHint,
  active,
  footerItems,
  footerOnly,
}: {
  label: string;
  items: Array<{ id: string; label: string; href: string; active?: boolean }>;
  emptyHint?: string;
  active?: boolean;
  footerItems?: NavFooterItem[];
  /** When true, dropdown shows only footer actions (e.g. Requests menu). */
  footerOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    return () => cancelScheduledClose();
  }, []);

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
      className={styles.navDropdown}
      onMouseEnter={() => {
        cancelScheduledClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(styles.navLink, styles.navDropdownTrigger, active && styles.navLinkActive)}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          cancelScheduledClose();
          setOpen((value) => !value);
        }}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(styles.navDropdownChevron, open && styles.navDropdownChevronOpen)}
          aria-hidden
        />
      </button>
      {open ? (
        <div className={styles.navDropdownMenu} role="menu">
          <div className={styles.navDropdownMenuInner}>
            {!footerOnly ? (
              items.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">{emptyHint ?? "No libraries yet"}</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={cn(styles.navDropdownItem, item.active && styles.navDropdownItemActive)}
                    onClick={() => {
                      cancelScheduledClose();
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    {item.label}
                  </button>
                ))
              )
            ) : null}
            {footerItems && footerItems.length > 0 ? (
              <>
                {!footerOnly && items.length > 0 ? <div className={styles.navDropdownDivider} /> : null}
                {footerItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={styles.navDropdownFooterItem}
                      onClick={() => {
                        cancelScheduledClose();
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
                      {item.label}
                    </button>
                  );
                })}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
