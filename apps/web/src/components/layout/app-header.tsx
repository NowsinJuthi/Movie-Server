"use client";

import {
  hasMinimumRole,
  LibraryKind,
  UserRole,
  type PublicProfile,
} from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Clapperboard,
  CreditCard,
  Film,
  Heart,
  History,
  Home,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  MonitorSmartphone,
  Settings,
  Sparkles,
  Tv,
  UserRound,
  X,
} from "lucide-react";
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
  onOpenAdminMenu,
}: {
  profile?: PublicProfile | null;
  planLabel?: string | null;
  scrolled?: boolean;
  /** browse = storefront; admin = solid bar over admin pages */
  variant?: "browse" | "admin";
  /** Mobile admin: open the admin navigation drawer (same role as browse hamburger). */
  onOpenAdminMenu?: () => void;
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
            {variant === "admin" && onOpenAdminMenu ? (
              <button
                type="button"
                aria-label="Open admin menu"
                className={cn(styles.iconBtn, styles.mobileMenuBtn, "lg:hidden")}
                onClick={onOpenAdminMenu}
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : null}
            <div className="hidden lg:block">{logoButton}</div>
          </div>

          {/* Center — mobile browse logo + desktop nav */}
          <div className="flex min-w-0 items-center justify-center justify-self-stretch overflow-visible lg:justify-self-center">
            {variant === "browse" ? (
              <div className={cn(styles.mobileLogoWrap, styles.mobileBrowseLogo)}>{logoButton}</div>
            ) : null}
            {variant === "admin" ? (
              <div className={cn(styles.mobileLogoWrap, styles.mobileBrowseLogo, "lg:hidden")}>
                {logoButton}
              </div>
            ) : null}

            {variant === "browse" ? (
              <nav className={styles.desktopNav} aria-label="Main">
                <div className={styles.browseNavPanel}>
                <HeaderLink href="/home" active={homeActive} icon={Home}>
                  Home
                </HeaderLink>
                <HeaderLink href="/home/welcome" active={discoverActive} icon={Sparkles}>
                  Discover
                </HeaderLink>
                <NavMenu
                  label="Movies"
                  icon={Film}
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
                            label: "Upload Request",
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
                  icon={Tv}
                  itemIcon={Tv}
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
                    label="Upload Request"
                    icon={Clapperboard}
                    active={requestsNavActive}
                    items={[]}
                    emptyHint={undefined}
                    footerItems={[
                      {
                        id: "req-movie",
                        label: "Upload Request",
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
                </div>
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
          <div className={styles.browseMenuPanel}>
            <div className={styles.browseSectionHead}>
              <span className={styles.browseSectionIcon} aria-hidden>
                <Clapperboard className="h-3.5 w-3.5" />
              </span>
              <p className={styles.browseSectionLabel}>Browse</p>
            </div>
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
                          Upload Request
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
                  Upload Request
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
                  Upload Request
                </MobileNavLink>
                {requestsOpen ? (
                  <ul className={styles.mobileSubmenu}>
                    <li>
                      <MobileNavLink
                        icon={Film}
                        onClick={() => onNavigate("/home/request-movie?kind=movie")}
                      >
                        Upload Request
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
          </div>

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
      <span
        className={styles.mobileNavIndicator}
        aria-hidden
        style={{ visibility: active ? "visible" : "hidden" }}
      />
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

function BrowseNavItemContent({
  icon: Icon,
  active,
  children,
  chevron,
  chevronOpen,
}: {
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  children: ReactNode;
  chevron?: boolean;
  chevronOpen?: boolean;
}) {
  return (
    <>
      <span
        className={styles.navIndicator}
        aria-hidden
        style={{ visibility: active ? "visible" : "hidden" }}
      />
      <span className={styles.navIconBox}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={styles.navLabel}>{children}</span>
      {chevron ? (
        <ChevronDown
          className={cn(styles.navDropdownChevron, chevronOpen && styles.navDropdownChevronOpen)}
          aria-hidden
        />
      ) : null}
    </>
  );
}

function HeaderLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn(styles.navLink, active && styles.navLinkActive)}
      onClick={() => router.push(href)}
    >
      <BrowseNavItemContent icon={icon} active={active}>
        {children}
      </BrowseNavItemContent>
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
        className={cn(styles.accountBtn, open && styles.accountBtnOpen)}
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
        <div role="menu" className={styles.accountMenuDropdown}>
          <div className={styles.accountMenuPanel}>
            <div className={styles.accountMenuHead}>
              <span className={styles.browseSectionIcon} aria-hidden>
                <UserRound className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{accountLabel}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {profile?.name
                    ? `Watching as ${profile.name}`
                    : isAdmin
                      ? "Admin"
                      : "Signed in"}
                </p>
              </div>
            </div>
            <ul className={styles.accountMenuList}>
              {profile ? (
                <li>
                  <MenuItem
                    icon={UserRound}
                    onClick={() => {
                      setOpen(false);
                      onProfiles();
                    }}
                  >
                    Switch profile
                  </MenuItem>
                </li>
              ) : null}
              <li>
                <MenuItem
                  icon={ListVideo}
                  onClick={() => {
                    setOpen(false);
                    onMyList();
                  }}
                >
                  My List
                </MenuItem>
              </li>
              <li>
                <MenuItem
                  icon={Heart}
                  onClick={() => {
                    setOpen(false);
                    onFavorites();
                  }}
                >
                  Favorites
                </MenuItem>
              </li>
              <li>
                <MenuItem
                  icon={History}
                  onClick={() => {
                    setOpen(false);
                    onHistory();
                  }}
                >
                  History
                </MenuItem>
              </li>
              <li>
                <MenuItem
                  icon={MonitorSmartphone}
                  onClick={() => {
                    setOpen(false);
                    onDevices();
                  }}
                >
                  Devices
                </MenuItem>
              </li>
              <li>
                <MenuItem
                  icon={Settings}
                  onClick={() => {
                    setOpen(false);
                    onSettings();
                  }}
                >
                  Account settings
                </MenuItem>
              </li>
              <li>
                <MenuItem
                  icon={CreditCard}
                  onClick={() => {
                    setOpen(false);
                    onSubscription();
                  }}
                >
                  Subscription
                </MenuItem>
              </li>
            </ul>
            {isAdmin ? (
              <>
                <p className={styles.accountMenuSectionLabel}>Workspace</p>
                <ul className={styles.accountMenuList}>
                  <li>
                    {onAdminRoute ? (
                      <MenuItem
                        icon={Home}
                        onClick={() => {
                          setOpen(false);
                          onHome();
                        }}
                      >
                        Browse home
                      </MenuItem>
                    ) : (
                      <MenuItem
                        icon={LayoutDashboard}
                        accent
                        onClick={() => {
                          setOpen(false);
                          onAdmin();
                        }}
                      >
                        Admin Dashboard
                      </MenuItem>
                    )}
                  </li>
                </ul>
              </>
            ) : null}
            <ul className={cn(styles.accountMenuList, styles.accountMenuListDanger)}>
              <li>
                <MenuItem
                  icon={LogOut}
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
                  {signingOut ? "Signing out…" : "Sign out"}
                </MenuItem>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  accent,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
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
        styles.accountMenuItem,
        accent && styles.accountMenuItemAccent,
        danger && styles.accountMenuItemDanger,
      )}
      onClick={onClick}
    >
      <span className={styles.accountMenuIconBox} aria-hidden>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={styles.navLabel}>{children}</span>
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
  icon,
  itemIcon: ItemIcon = Film,
  items,
  emptyHint,
  active,
  footerItems,
  footerOnly,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  itemIcon?: ComponentType<{ className?: string }>;
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
        <BrowseNavItemContent icon={icon} active={active} chevron chevronOpen={open}>
          {label}
        </BrowseNavItemContent>
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
                    <span
                      className={styles.navIndicator}
                      aria-hidden
                      style={{ visibility: item.active ? "visible" : "hidden" }}
                    />
                    <span className={styles.navDropdownIconBox} aria-hidden>
                      <ItemIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
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
                      {Icon ? (
                        <span className={styles.navDropdownIconBox} aria-hidden>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      <span className="min-w-0 truncate">{item.label}</span>
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
