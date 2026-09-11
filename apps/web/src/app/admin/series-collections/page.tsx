"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clapperboard,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Tv,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SeriesEditDialog } from "@/components/admin/series-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { seriesApi } from "@/lib/series-api";
import { cn } from "@/lib/utils";
import styles from "../collections/collections-page.module.css";

export default function AdminSeriesCollectionsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [editSeriesId, setEditSeriesId] = useState<string | null>(null);

  const seriesQuery = useQuery({
    queryKey: ["admin-series", "collections-bulk", q],
    queryFn: () => seriesApi.adminList({ q: q || undefined, limit: 50, sort: "newest" }),
  });

  const bulk = useMutation({
    mutationFn: (action: "publish" | "unpublish" | "delete" | "feature" | "trending") =>
      seriesApi.bulk(selected, action),
    onSuccess: async () => {
      setSelected([]);
      setPendingDelete(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-series"] });
    },
  });

  const items = seriesQuery.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const pageError = bulk.error instanceof ApiError ? bulk.error.message : null;

  const stats = useMemo(() => {
    const published = items.filter((item) => item.published).length;
    const available = items.filter((item) => item.availability === "available").length;
    const featured = items.filter((item) => item.featured).length;
    return {
      total: items.length,
      published,
      available,
      featured,
    };
  }, [items]);

  return (
    <AdminPage
      title="Series collections"
      description="Browse TV series, edit in a popup, and run bulk publish / feature / trending actions."
      error={pageError}
    >
      <div className={styles.layout}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <Tv className="h-4 w-4" />
            </span>
            <span>
              <span className={styles.statLabel}>On page</span>
              <span className={styles.statValue}>{stats.total}</span>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span>
              <span className={styles.statLabel}>Published</span>
              <span className={styles.statValue}>{stats.published}</span>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <Clapperboard className="h-4 w-4" />
            </span>
            <span>
              <span className={styles.statLabel}>Available</span>
              <span className={styles.statValue}>{stats.available}</span>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              <span className={styles.statLabel}>Featured</span>
              <span className={styles.statValue}>{stats.featured}</span>
            </span>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search className={cn(styles.searchIcon, "h-4 w-4")} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search series..."
              className={styles.searchInput}
            />
          </div>

          {selected.length > 0 ? (
            <span className={styles.selectionChip}>{selected.length} selected</span>
          ) : null}

          <div className={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected.length || bulk.isPending}
              onClick={() => bulk.mutate("publish")}
            >
              Publish
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected.length || bulk.isPending}
              onClick={() => bulk.mutate("feature")}
            >
              Feature
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected.length || bulk.isPending}
              onClick={() => bulk.mutate("trending")}
            >
              Trending
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected.length || bulk.isPending}
              onClick={() => bulk.mutate("unpublish")}
            >
              Unpublish
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!selected.length || bulk.isPending}
              onClick={() => setPendingDelete(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? items.map((item) => item.id) : [])}
                    aria-label="Select all"
                  />
                </th>
                <th>Title</th>
                <th>Year</th>
                <th>Status</th>
                <th>Availability</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = selected.includes(item.id);
                const initial = item.title.trim().charAt(0).toUpperCase() || "S";
                return (
                  <tr key={item.id} className={cn(isSelected && styles.rowSelected)}>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                        aria-label={`Select ${item.title}`}
                      />
                    </td>
                    <td>
                      <div className={styles.titleCell}>
                        <span className={styles.posterThumb} aria-hidden={!item.posterUrl}>
                          {item.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.posterUrl} alt="" />
                          ) : (
                            <span className={styles.posterFallback}>{initial}</span>
                          )}
                        </span>
                        <span className={styles.titleText}>
                          <span className={styles.titleName}>{item.title}</span>
                          <span className={styles.titleMeta}>
                            {item.featured ? "Featured" : "Catalog"}
                            {item.trending ? " · Trending" : ""}
                            {item.seasonCount ? ` · ${item.seasonCount} seasons` : ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>{item.firstAirYear}</td>
                    <td>
                      <span
                        className={cn(
                          styles.badge,
                          item.published ? styles.badgePublished : styles.badgeDraft,
                        )}
                      >
                        {item.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={cn(
                          styles.badge,
                          item.availability === "available"
                            ? styles.badgeAvailable
                            : styles.badgeUnavailable,
                        )}
                      >
                        {item.availability}
                      </span>
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditSeriesId(item.id)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!seriesQuery.data && !seriesQuery.error ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Loading catalog...</p>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <Tv className="h-5 w-5" />
              </div>
              <p className={styles.emptyTitle}>No series found</p>
              <p className={styles.emptyText}>
                {q ? "Try a different search." : "Import TV libraries or add a series manually."}
              </p>
            </div>
          ) : null}
        </div>

        <ConfirmDialog
          open={pendingDelete}
          title="Delete selected series?"
          description="Published and draft series will be removed with their seasons and episodes. This cannot be undone from the admin UI."
          confirmLabel="Delete"
          pending={bulk.isPending}
          onClose={() => setPendingDelete(false)}
          onConfirm={() => bulk.mutate("delete")}
        />

        <SeriesEditDialog
          seriesId={editSeriesId}
          open={Boolean(editSeriesId)}
          onClose={() => setEditSeriesId(null)}
        />
      </div>
    </AdminPage>
  );
}
