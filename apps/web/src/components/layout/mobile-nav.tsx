"use client";

import { LibraryKind } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Home, LayoutGrid, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MobileBottomSheet } from "@/components/player/emby-mobile-chrome";
import { publicLibraryApi } from "@/lib/public-library-api";
import { cn } from "@/lib/utils";

function NavTab({
  href,
  label,
  active,
  icon,
  onClick,
}: {
  href?: string;
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    "flex min-h-11 min-w-[3.5rem] flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors",
    active ? "text-primary" : "text-white/55 active:text-white/80",
  );

  if (onClick) {
    return (
      <button type="button" aria-label={label} aria-current={active ? "page" : undefined} className={className} onClick={onClick}>
        {icon}
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <Link href={href!} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [browseOpen, setBrowseOpen] = useState(false);

  const librariesQuery = useQuery({
    queryKey: ["public-libraries"],
    queryFn: publicLibraryApi.list,
    staleTime: 60_000,
  });

  const libraries = librariesQuery.data?.libraries ?? [];
  const movieLibraries = libraries.filter((library) => library.kind === LibraryKind.Movies);
  const tvLibraries = libraries.filter((library) => library.kind === LibraryKind.Tv);

  const isHome = pathname === "/home";
  const isSearch = pathname?.startsWith("/home/search") ?? false;
  const isLibrary =
    pathname?.startsWith("/home/library/") ||
    pathname?.startsWith("/home/movies/") ||
    pathname?.startsWith("/home/series/") ||
    false;
  const isList =
    pathname?.startsWith("/home/list") ||
    pathname?.startsWith("/home/favorites") ||
    pathname?.startsWith("/home/history") ||
    false;
  const isProfile = pathname?.startsWith("/profiles") || pathname?.startsWith("/account") || false;

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          <NavTab
            href="/home"
            label="Home"
            active={isHome}
            icon={<Home className={cn("h-5 w-5", isHome && "stroke-[2.5]")} />}
          />
          <NavTab
            label="Browse"
            active={isLibrary || browseOpen}
            icon={<LayoutGrid className={cn("h-5 w-5", (isLibrary || browseOpen) && "stroke-[2.5]")} />}
            onClick={() => setBrowseOpen(true)}
          />
          <NavTab
            href="/home/search"
            label="Search"
            active={isSearch}
            icon={<Search className={cn("h-5 w-5", isSearch && "stroke-[2.5]")} />}
          />
          <NavTab
            href="/home/list"
            label="My List"
            active={isList}
            icon={<Clapperboard className={cn("h-5 w-5", isList && "stroke-[2.5]")} />}
          />
          <NavTab
            href="/profiles"
            label="Profile"
            active={isProfile}
            icon={<User className={cn("h-5 w-5", isProfile && "stroke-[2.5]")} />}
          />
        </div>
      </nav>

      {browseOpen ? (
        <MobileBottomSheet title="Browse" onClose={() => setBrowseOpen(false)}>
          <div className="space-y-4 px-5 py-3">
            {movieLibraries.length > 0 ? (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">Movies</p>
                <ul className="space-y-1">
                  {movieLibraries.map((library) => (
                    <li key={library.id}>
                      <button
                        type="button"
                        className="flex w-full touch-manipulation items-center rounded-lg px-3 py-3 text-left text-sm text-white/90 active:bg-white/10"
                        onClick={() => {
                          setBrowseOpen(false);
                          router.push(`/home/library/${library.id}`);
                        }}
                      >
                        {library.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {tvLibraries.length > 0 ? (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">TV Shows</p>
                <ul className="space-y-1">
                  {tvLibraries.map((library) => (
                    <li key={library.id}>
                      <button
                        type="button"
                        className="flex w-full touch-manipulation items-center rounded-lg px-3 py-3 text-left text-sm text-white/90 active:bg-white/10"
                        onClick={() => {
                          setBrowseOpen(false);
                          router.push(`/home/library/${library.id}`);
                        }}
                      >
                        {library.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {movieLibraries.length === 0 && tvLibraries.length === 0 ? (
              <p className="py-4 text-sm text-white/55">No libraries available yet.</p>
            ) : null}
          </div>
        </MobileBottomSheet>
      ) : null}
    </>
  );
}
