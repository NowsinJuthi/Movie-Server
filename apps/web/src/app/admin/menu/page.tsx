"use client";

import { useQuery } from "@tanstack/react-query";
import { Film, HardDrive, Menu, Tv } from "lucide-react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminMetricGrid } from "@/components/admin/admin-ui";
import { ApiError } from "@/lib/api";
import { libraryApi } from "@/lib/library-api";
import { cn } from "@/lib/utils";

export default function AdminMenuPage() {
  const query = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: libraryApi.list,
  });

  const libraries = (query.data?.libraries ?? []).filter((library) => library.enabled);
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage
      title="Menu"
      description="Media library names appear here as menu items. Open a name to browse that directory’s indexed files."
      error={error}
      actions={
        <Link
          href="/admin/libraries"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:border-primary/40"
        >
          Manage libraries
        </Link>
      }
    >
      {!query.data && !error ? (
        <p className="text-sm text-muted-foreground">Loading menu...</p>
      ) : libraries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <Menu className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No enabled media libraries yet. Add a directory in Media libraries — its name will show here as a menu
            item.
          </p>
          <Link href="/admin/libraries" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Go to Media libraries →
          </Link>
        </div>
      ) : (
        <AdminMetricGrid variant="xl3">
          {libraries.map((library) => {
            const Icon = library.kind === "tv" ? Tv : Film;
            return (
              <Link
                key={library.id}
                href={`/admin/menu/${library.id}`}
                className={cn(
                  "group admin-card-compact min-h-[4.5rem] touch-manipulation transition-colors",
                  "hover:border-primary/45 hover:bg-secondary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    {library.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={library.imageUrl}
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold tracking-tight group-hover:text-primary">
                      {library.name}
                    </p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {library.kind} · {library.itemCount} items
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
                      <HardDrive className="mr-1 inline h-3 w-3" />
                      {library.rootLabel}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </AdminMetricGrid>
      )}
    </AdminPage>
  );
}
