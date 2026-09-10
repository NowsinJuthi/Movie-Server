"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearch } from "@/components/admin/admin-filters";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminAuditPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-audit", q, page],
    queryFn: () => adminApi.audit({ q: q || undefined, page, limit: 25 }),
  });
  const error = query.error instanceof ApiError ? query.error.message : null;

  return (
    <AdminPage title="Audit log" description="Mutating admin API calls are recorded server-side. Tokens and passwords are never stored." error={error}>
      <div className="mb-4">
        <AdminSearch value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder="Search actor, action, or path" />
      </div>
      <AdminTable columns={["When", "Actor", "Action", "Path", "Status"]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{new Date(item.createdAt).toLocaleString()}</AdminTd>
            <AdminTd>
              {item.actorEmail}
              <span className="block text-xs capitalize text-muted-foreground">{item.actorRole.replace("_", " ")}</span>
            </AdminTd>
            <AdminTd>{item.action}</AdminTd>
            <AdminTd className="max-w-xs truncate font-mono text-xs">{item.path}</AdminTd>
            <AdminTd>{item.statusCode}</AdminTd>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
    </AdminPage>
  );
}
