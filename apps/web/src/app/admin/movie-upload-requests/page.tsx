"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MOVIE_UPLOAD_REQUEST_STATUSES, type MovieUploadRequestStatus } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearch } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

const STATUS_LABEL: Record<MovieUploadRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

export default function AdminMovieUploadRequestsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MovieUploadRequestStatus | "">("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-movie-upload-requests", q, status, page],
    queryFn: () =>
      adminApi.movieUploadRequests({
        q: q || undefined,
        status: status || undefined,
        page,
        limit: 25,
      }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: MovieUploadRequestStatus }) =>
      adminApi.patchMovieUploadRequest(id, { status: next }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-movie-upload-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage
      title="Movie upload requests"
      description="Member requests for titles to add to the library. Update status as you upload or reject."
      error={error}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <AdminSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search title or member"
        />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MovieUploadRequestStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {MOVIE_UPLOAD_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <AdminTable columns={["Submitted", "Title", "Member", "Profile", "Status", "Actions"]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{new Date(item.createdAt).toLocaleString()}</AdminTd>
            <AdminTd>
              {item.title}
              {item.year ? ` (${item.year})` : ""}
              {item.note ? (
                <span className="mt-1 block max-w-xs truncate text-xs text-muted-foreground">{item.note}</span>
              ) : null}
            </AdminTd>
            <AdminTd>
              {item.userDisplayName}
              <span className="block text-xs text-muted-foreground">{item.userEmail}</span>
            </AdminTd>
            <AdminTd>{item.profileName ?? "—"}</AdminTd>
            <AdminTd>{STATUS_LABEL[item.status]}</AdminTd>
            <AdminTd>
              <div className="flex flex-wrap gap-1">
                {MOVIE_UPLOAD_REQUEST_STATUSES.filter((s) => s !== item.status).map((next) => (
                  <Button
                    key={next}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: item.id, next })}
                  >
                    {STATUS_LABEL[next]}
                  </Button>
                ))}
              </div>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
    </AdminPage>
  );
}
