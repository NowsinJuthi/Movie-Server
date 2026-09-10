"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BulkMovieAction, BulkSeriesAction } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { movieApi } from "@/lib/movie-api";
import { seriesApi } from "@/lib/series-api";
import { ApiError } from "@/lib/api";

export default function AdminFeaturedPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"featured" | "trending">("featured");
  const movies = useQuery({
    queryKey: ["admin-featured-movies", tab],
    queryFn: () => movieApi.adminList({ [tab]: true, limit: 50, sort: "newest" }),
  });
  const series = useQuery({
    queryKey: ["admin-featured-series", tab],
    queryFn: () => seriesApi.adminList({ [tab]: true, limit: 50, sort: "newest" }),
  });
  const movieBulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkMovieAction }) => movieApi.bulk(ids, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-featured-movies"] }),
  });
  const seriesBulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkSeriesAction }) => seriesApi.bulk(ids, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-featured-series"] }),
  });
  const error =
    movies.error instanceof ApiError
      ? movies.error.message
      : series.error instanceof ApiError
        ? series.error.message
        : movieBulk.error instanceof ApiError
          ? movieBulk.error.message
          : seriesBulk.error instanceof ApiError
            ? seriesBulk.error.message
            : null;
  const unfeature = tab === "featured" ? BulkMovieAction.Unfeature : BulkMovieAction.Untrending;
  const unfeatureSeries = tab === "featured" ? BulkSeriesAction.Unfeature : BulkSeriesAction.Untrending;

  return (
    <AdminPage
      title="Featured & trending"
      description="These flags drive the default homepage hero and rows. Bulk actions are applied on the server."
      error={error}
      actions={
        <>
          <Button variant={tab === "featured" ? "default" : "outline"} onClick={() => setTab("featured")}>
            Featured
          </Button>
          <Button variant={tab === "trending" ? "default" : "outline"} onClick={() => setTab("trending")}>
            Trending
          </Button>
        </>
      }
    >
      <h2 className="mb-3 text-lg font-medium">Movies</h2>
      <AdminTable columns={["Title", "Year", "Published", ""]}>
        {(movies.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{item.title}</AdminTd>
            <AdminTd>{item.releaseYear}</AdminTd>
            <AdminTd>{item.published ? "Yes" : "No"}</AdminTd>
            <AdminTd>
              <Button size="sm" variant="secondary" onClick={() => movieBulk.mutate({ ids: [item.id], action: unfeature })}>
                Remove
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <h2 className="mb-3 mt-8 text-lg font-medium">Series</h2>
      <AdminTable columns={["Title", "Year", "Published", ""]}>
        {(series.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{item.title}</AdminTd>
            <AdminTd>{item.firstAirYear}</AdminTd>
            <AdminTd>{item.published ? "Yes" : "No"}</AdminTd>
            <AdminTd>
              <Button size="sm" variant="secondary" onClick={() => seriesBulk.mutate({ ids: [item.id], action: unfeatureSeries })}>
                Remove
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
    </AdminPage>
  );
}
