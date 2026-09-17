"use client";

import {
  Clapperboard,
  LayoutDashboard,
  Menu,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function AdminNavTab({
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
      <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={className}
        onClick={onClick}
      >
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

export function AdminMobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const isDashboard = pathname === "/admin";
  const isUsers =
    pathname?.startsWith("/admin/users") ||
    pathname?.startsWith("/admin/profiles") ||
    pathname?.startsWith("/admin/plans") ||
    pathname?.startsWith("/admin/subscriptions") ||
    pathname?.startsWith("/admin/billing") ||
    false;
  const isCatalog =
    pathname?.startsWith("/admin/movies") ||
    pathname?.startsWith("/admin/series") ||
    pathname?.startsWith("/admin/collections") ||
    pathname?.startsWith("/admin/series-collections") ||
    pathname?.startsWith("/admin/genres") ||
    pathname?.startsWith("/admin/tags") ||
    pathname?.startsWith("/admin/tracks") ||
    pathname?.startsWith("/admin/featured") ||
    pathname?.startsWith("/admin/home") ||
    false;

  return (
    <nav
      aria-label="Admin mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        <AdminNavTab
          href="/admin"
          label="Dashboard"
          active={isDashboard}
          icon={<LayoutDashboard className={cn("h-5 w-5", isDashboard && "stroke-[2.5]")} />}
        />
        <AdminNavTab
          href="/admin/users"
          label="People"
          active={isUsers}
          icon={<Users className={cn("h-5 w-5", isUsers && "stroke-[2.5]")} />}
        />
        <AdminNavTab
          href="/admin/movies"
          label="Catalog"
          active={isCatalog}
          icon={<Clapperboard className={cn("h-5 w-5", isCatalog && "stroke-[2.5]")} />}
        />
        <AdminNavTab
          label="Menu"
          active={false}
          icon={<Menu className="h-5 w-5" />}
          onClick={onOpenMenu}
        />
      </div>
    </nav>
  );
}
