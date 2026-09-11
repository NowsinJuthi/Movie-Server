"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Film, RefreshCw, Tv } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { libraryApi } from "@/lib/library-api";
import { cn } from "@/lib/utils";

export default function AdminMenuLibraryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const librariesQuery = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: libraryApi.list,
  });

  const itemsQuery = useQuery({
    queryKey: ["admin-library-items", id],
    queryFn: () => libraryApi.items(id),
    enabled: Boolean(id),
  });

  const library = librariesQuery.data?.libraries.find((row) => row.id === id);
  const items = itemsQuery.data?.items ?? [];
  const error =
    (librariesQuery.error instanceof ApiError ? librariesQuery.error.message : null) ??
    (itemsQuery.error instanceof ApiError ? itemsQuery.error.message : null);

  const Icon = library?.kind === "tv" ? Tv : Film;

  return (
    <AdminPage
      title={library?.name ?? "Library menu"}
      description={
        library
          ? `${library.kind} library · ${library.rootLabel}`
          : "Browse indexed files for this media library menu item."
      }
      error={error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/menu" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              All menus
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/libraries" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Libraries
            </Link>
          </Button>
        </div>
      }
    >
      {!library && !librariesQuery.isLoading ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          This menu item was not found. It may have been removed.
        </div>
      ) : (
        <div className="space-y-4">
          {library ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {library.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={library.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="font-semibold">{library.name}</p>
                <p className="text-xs text-muted-foreground">
                  {library.itemCount} items · {library.missingCount} missing · {library.unmatchedCount} unmatched
                </p>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">Codec</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = item.ignored ? "ignored" : item.status;
                  return (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3">{item.fileName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs capitalize",
                            status === "matched" || status === "imported"
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.ignored ? "excluded" : (item.matchTitle ?? item.match)}
                      </td>
                      <td className="px-4 py-3">{item.probe?.resolution ?? "—"}</td>
                      <td className="px-4 py-3">{item.probe?.videoCodec ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!itemsQuery.isLoading && items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">No files indexed in this library yet.</p>
            ) : null}
          </div>
        </div>
      )}
    </AdminPage>
  );
}
