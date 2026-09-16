"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronDown,
  Clapperboard,
  ClipboardList,
  CreditCard,
  Film,
  FolderKanban,
  HardDrive,
  Heart,
  KeyRound,
  LayoutDashboard,
  Library,
  ListMusic,
  Menu,
  MonitorPlay,
  Settings2,
  Shield,
  Tags,
  Tv,
  Users,
  Wallet,
} from "lucide-react";
import { hasMinimumRole, UserRole, type PermissionKey } from "@movie-server/shared";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { libraryApi } from "@/lib/library-api";
import { canAccessAdminRoute } from "@/lib/admin-nav-permissions";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { AppHeader } from "@/components/layout/app-header";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import styles from "./admin-shell.module.css";

type NavIcon = ComponentType<{ className?: string }>;

type NavChild = {
  href: string;
  label: string;
  icon: NavIcon;
};

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** When set (even `[]`), item always renders as an expandable group. */
  children?: NavChild[];
};

type NavSection = {
  id: "overview" | "accounts" | "catalog" | "operations";
  label: string;
  icon: NavIcon;
  items: NavItem[];
};

const NAV: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/menu", label: "Menu", icon: Menu, children: [] },
      {
        href: "/admin/health",
        label: "System",
        icon: Activity,
        children: [
          { href: "/admin/health", label: "Health", icon: Activity },
          { href: "/admin/settings", label: "Settings", icon: Settings2 },
          { href: "/admin/license", label: "License", icon: KeyRound },
          { href: "/admin/jobs", label: "Jobs", icon: Settings2 },
          { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
          { href: "/admin/settings/roles", label: "Roles & permissions", icon: Shield },
          { href: "/admin/slider", label: "Home slider", icon: MonitorPlay },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Users,
    items: [
      {
        href: "/admin/users",
        label: "People",
        icon: Users,
        children: [
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/profiles", label: "Profiles", icon: Heart },
        ],
      },
      {
        href: "/admin/plans",
        label: "Billing",
        icon: CreditCard,
        children: [
          { href: "/admin/plans", label: "Plans", icon: CreditCard },
          { href: "/admin/subscriptions", label: "Subscriptions", icon: Wallet },
          { href: "/admin/billing", label: "Payments", icon: Wallet },
        ],
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Clapperboard,
    items: [
      {
        href: "/admin/movies",
        label: "Titles",
        icon: Film,
        children: [
          { href: "/admin/movies", label: "Add Manually Movies", icon: Film },
          { href: "/admin/series", label: "TV series", icon: Tv },
        ],
      },
      {
        href: "/admin/collections",
        label: "Collections",
        icon: FolderKanban,
        children: [
          { href: "/admin/collections", label: "Movie collections", icon: FolderKanban },
          { href: "/admin/series-collections", label: "Series collections", icon: Library },
        ],
      },
      {
        href: "/admin/genres",
        label: "Metadata",
        icon: Tags,
        children: [
          { href: "/admin/tracks", label: "Audio & subtitles", icon: ListMusic },
          { href: "/admin/genres", label: "Genres", icon: Tags },
          { href: "/admin/tags", label: "Tags", icon: Tags },
        ],
      },
      {
        href: "/admin/featured",
        label: "Discovery",
        icon: MonitorPlay,
        children: [
          { href: "/admin/featured", label: "Featured / trending", icon: Heart },
          { href: "/admin/home", label: "Homepage", icon: MonitorPlay },
        ],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: HardDrive,
    items: [
      {
        href: "/admin/libraries",
        label: "Add Media library",
        icon: HardDrive,
        children: [
          { href: "/admin/libraries", label: "Media library", icon: HardDrive },
          { href: "/admin/file-manager", label: "Samba file manager", icon: FolderKanban },
          { href: "/admin/sessions", label: "Sessions & streams", icon: MonitorPlay },
        ],
      },
    ],
  },
];

const SECTION_CLASS: Record<NavSection["id"], string> = {
  overview: styles["section--overview"]!,
  accounts: styles["section--accounts"]!,
  catalog: styles["section--catalog"]!,
  operations: styles["section--operations"]!,
};

const EXPANDED_KEY = "amarpin-admin-nav-expanded";

function isLinkActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasActiveChild(pathname: string | null, item: NavItem) {
  return Boolean(item.children?.some((child) => isLinkActive(pathname, child.href)));
}

function isGroupRouteOpen(pathname: string | null, item: NavItem) {
  return isLinkActive(pathname, item.href) || hasActiveChild(pathname, item);
}

function readExpandedGroup(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(EXPANDED_KEY);
  } catch {
    return null;
  }
}

function writeExpandedGroup(href: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (href) sessionStorage.setItem(EXPANDED_KEY, href);
    else sessionStorage.removeItem(EXPANDED_KEY);
  } catch {
    /* ignore */
  }
}

function useGroupOpenState(pathname: string | null) {
  const [manualExpanded, setManualExpanded] = useState<string | null>(readExpandedGroup);
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setManualCollapsed(new Set());
    setManualExpanded(null);
  }, [pathname]);

  useEffect(() => {
    writeExpandedGroup(manualExpanded);
  }, [manualExpanded]);

  const isGroupOpen = useCallback(
    (item: NavItem) => {
      if (item.children === undefined) return false;
      if (manualCollapsed.has(item.href)) return false;
      if (isGroupRouteOpen(pathname, item)) return true;
      if (manualExpanded) return manualExpanded === item.href;
      return false;
    },
    [manualCollapsed, manualExpanded, pathname],
  );

  const expandGroup = useCallback((item: NavItem) => {
    setManualCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(item.href);
      return next;
    });
    setManualExpanded(item.href);
  }, []);

  const toggleGroup = useCallback(
    (item: NavItem) => {
      const routeOpen = isGroupRouteOpen(pathname, item);
      const open =
        !manualCollapsed.has(item.href) &&
        (routeOpen || manualExpanded === item.href);

      if (open) {
        if (routeOpen) {
          setManualCollapsed((prev) => {
            const next = new Set(prev);
            next.add(item.href);
            return next;
          });
          setManualExpanded(null);
          return;
        }
        setManualExpanded(null);
        return;
      }

      setManualCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(item.href);
        return next;
      });
      setManualExpanded(item.href);
    },
    [manualCollapsed, manualExpanded, pathname],
  );

  return { isGroupOpen, toggleGroup, expandGroup };
}

function filterNavByPermissions(
  sections: NavSection[],
  can: (key: PermissionKey) => boolean,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.children !== undefined) {
            const children = item.children.filter((child) => canAccessAdminRoute(child.href, can));
            if (children.length === 0 && !canAccessAdminRoute(item.href, can)) {
              return null;
            }
            return { ...item, children };
          }
          return canAccessAdminRoute(item.href, can) ? item : null;
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((section) => section.items.length > 0);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useAuthStore();
  const { can, canAccessAdminPanel, isLoading: permissionsLoading } = useAdminPermissions();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isGroupOpen, toggleGroup, expandGroup } = useGroupOpenState(pathname);
  const librariesQuery = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: libraryApi.list,
    enabled: status === "authenticated" && Boolean(user && hasMinimumRole(user.role, UserRole.Admin)),
  });

  const nav = useMemo(() => {
    const libraries = (librariesQuery.data?.libraries ?? []).filter((library) => library.enabled);
    const menuChildren: NavChild[] = libraries.map((library) => ({
      href: `/admin/menu/${library.id}`,
      label: library.name,
      icon: library.kind === "tv" ? Tv : Film,
    }));

    return NAV.map((section) => {
      if (section.id !== "overview") return section;
      return {
        ...section,
        items: section.items.map((item) => {
          if (item.href !== "/admin/menu") return item;
          return {
            ...item,
            // Always keep an array so this never flips between link ↔ group (causes removeChild).
            children: menuChildren,
          };
        }),
      };
    });
  }, [librariesQuery.data?.libraries]);

  const filteredNav = useMemo(
    () => filterNavByPermissions(nav, can),
    [nav, can],
  );

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${pathname || "/admin"}`);
    } else if (user && !hasMinimumRole(user.role, UserRole.Admin)) {
      router.replace("/unauthorized");
    } else if (
      user &&
      hasMinimumRole(user.role, UserRole.Admin) &&
      !permissionsLoading &&
      !canAccessAdminPanel
    ) {
      router.replace("/unauthorized");
    }
  }, [status, user, router, pathname, permissionsLoading, canAccessAdminPanel]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access...
      </main>
    );
  }
  if (!user || !hasMinimumRole(user.role, UserRole.Admin)) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access...
      </main>
    );
  }

  return (
    <div className={cn(styles.adminPanel, "admin-panel")}>
      <AppHeader variant="admin" scrolled />
      {mobileNavOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close admin menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <div className={styles.shell}>
        <aside className={cn(styles.sidebar, mobileNavOpen && styles.sidebarOpen)}>
          <nav className={styles.sidebarNav} aria-label="Admin">
            <div className={styles.menuPanel}>
                  <div className={cn(styles.menuScroll, "brand-scrollbar")}>
                <div className={styles.menuScrollInner}>
                  {filteredNav.map((section) => {
                    const SectionIcon = section.icon;
                    return (
                      <div
                        key={section.id}
                        className={cn(styles.section, SECTION_CLASS[section.id])}
                      >
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionIcon} aria-hidden>
                            <SectionIcon className="h-3.5 w-3.5" />
                          </span>
                          <p className={styles.sectionLabel}>{section.label}</p>
                        </div>
                        <ul className={styles.itemList}>
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            const isGroup = item.children !== undefined;

                            if (!isGroup) {
                              const active = isLinkActive(pathname, item.href);
                              return (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    className={cn(styles.navLink, active && styles.navLinkActive)}
                                  >
                                  <span
                                    className={styles.indicator}
                                    aria-hidden
                                    style={{ visibility: active ? "visible" : "hidden" }}
                                  />
                                    <span className={styles.iconBox}>
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <span className={styles.label}>{item.label}</span>
                                  </Link>
                                </li>
                              );
                            }

                            const children = item.children ?? [];
                            const open = isGroupOpen(item);
                            const childActive = hasActiveChild(pathname, item);
                            const parentActive =
                              isLinkActive(pathname, item.href) && !childActive;

                            return (
                              <li
                                key={item.href}
                                className={cn(styles.navGroup, open && styles.navGroupOpen)}
                              >
                                <div
                                  className={cn(
                                    styles.navLink,
                                    styles.navLinkGroup,
                                    (parentActive || (open && childActive)) && styles.navLinkActive,
                                  )}
                                >
                                  <span
                                    className={styles.indicator}
                                    aria-hidden
                                    style={{
                                      visibility: parentActive ? "visible" : "hidden",
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.navLinkMain}
                                    onClick={() => {
                                      if (open) {
                                        router.push(item.href);
                                      } else {
                                        expandGroup(item);
                                      }
                                    }}
                                  >
                                    <span className={styles.iconBox}>
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <span className={styles.label}>{item.label}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.chevron}
                                    aria-expanded={open}
                                    aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleGroup(item);
                                    }}
                                  >
                                    <ChevronDown
                                      className={cn(
                                        styles.chevronIcon,
                                        open && styles.chevronIconOpen,
                                      )}
                                    />
                                  </button>
                                </div>

                                <div
                                  className={styles.subnavBox}
                                  hidden={!open}
                                  aria-hidden={!open}
                                >
                                    <ul className={styles.subnavInner}>
                                      {children.map((child) => {
                                          const ChildIcon = child.icon;
                                          const active = isLinkActive(pathname, child.href);
                                          return (
                                            <li key={child.href}>
                                              <Link
                                                href={child.href}
                                                tabIndex={open ? 0 : -1}
                                                className={cn(
                                                  styles.subnavLink,
                                                  active && styles.subnavLinkActive,
                                                )}
                                              >
                                                <span
                                                  className={styles.subnavIndicator}
                                                  aria-hidden
                                                  style={{
                                                    visibility: active ? "visible" : "hidden",
                                                  }}
                                                />
                                                <span
                                                  className={cn(
                                                    styles.subnavIconBox,
                                                    active && styles.subnavIconBoxActive,
                                                  )}
                                                >
                                                  <ChildIcon className="h-3.5 w-3.5" />
                                                </span>
                                                <span className={styles.label}>{child.label}</span>
                                              </Link>
                                            </li>
                                          );
                                        })}
                                      {children.length === 0 && item.href === "/admin/menu" ? (
                                        <li key="__add-library">
                                          <Link
                                            href="/admin/libraries"
                                            className={styles.subnavLink}
                                            tabIndex={open ? 0 : -1}
                                          >
                                            <span className={styles.subnavIconBox}>
                                              <HardDrive className="h-3.5 w-3.5" />
                                            </span>
                                            <span className={styles.label}>Add a library</span>
                                          </Link>
                                        </li>
                                      ) : null}
                                    </ul>
                                  </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>

          <p className={styles.sidebarFoot}>
            Signed in as {user.email}
            {user.role === UserRole.SuperAdmin ? " · Super Admin" : " · Admin"}
          </p>
        </aside>

        <div className={cn(styles.content, "brand-scrollbar")}>
          {children}
        </div>
      </div>
      <AdminMobileNav onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  );
}
