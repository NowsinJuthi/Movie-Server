"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MediaKind } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearch, AdminSelect } from "@/components/admin/admin-filters";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminTracksPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-tracks", q, kind, page],
    queryFn: () => adminApi.tracks({ q: q || undefined, kind: kind || undefined, page, limit: 25 }),
  });
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage title="Audio & subtitle tracks" description="All attached audio and subtitle assets. Edit them from the movie or episode page." error={error}>
      <div className="mb-4 flex flex-wrap gap-3">
        <AdminSearch value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder="Search label or language" />
        <AdminSelect
          label="Kind"
          value={kind}
          onChange={(value) => { setKind(value); setPage(1); }}
          options={[
            { value: "", label: "All" },
            { value: MediaKind.Audio, label: "Audio" },
            { value: MediaKind.Subtitle, label: "Subtitles" },
          ]}
        />
      </div>
      <AdminTable columns={["Kind", "Label", "Language", "Format / codec", "Parent", "Status"]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd className="capitalize">{item.kind}</AdminTd>
            <AdminTd>{item.label || "—"}</AdminTd>
            <AdminTd>{item.language || "—"}</AdminTd>
            <AdminTd>{item.format || item.codec || "—"}</AdminTd>
            <AdminTd className="font-mono text-xs">{item.movieId ?? item.episodeId ?? "unmatched"}</AdminTd>
            <AdminTd>{item.status}</AdminTd>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
    </AdminPage>
  );
}
