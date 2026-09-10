"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearch } from "@/components/admin/admin-filters";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminProfilesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-profiles", q, page],
    queryFn: () => adminApi.profiles({ q: q || undefined, page, limit: 25 }),
  });
  const remove = useMutation({
    mutationFn: adminApi.deleteProfile,
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
  });
  const error = query.error instanceof ApiError ? query.error.message : remove.error instanceof ApiError ? remove.error.message : null;

  return (
    <AdminPage title="Profiles" description="Every profile across accounts. The last profile on an account cannot be deleted." error={error}>
      <div className="mb-4">
        <AdminSearch value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder="Search profile name" />
      </div>
      <AdminTable columns={["Profile", "Account", "Kids", "PIN", "Maturity", ""]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{item.name}</AdminTd>
            <AdminTd>
              {item.userDisplayName}
              <span className="block text-xs text-muted-foreground">{item.userEmail}</span>
            </AdminTd>
            <AdminTd>{item.isKids ? "Yes" : "No"}</AdminTd>
            <AdminTd>{item.hasPin ? "Yes" : "No"}</AdminTd>
            <AdminTd className="capitalize">{item.maturityLevel}</AdminTd>
            <AdminTd>
              <Button size="sm" variant="secondary" onClick={() => setPending(item.id)}>
                Delete
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this profile?"
        description="Watch history, lists, and ratings for this profile are removed. This cannot be undone."
        confirmLabel="Delete profile"
        pending={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending)}
      />
    </AdminPage>
  );
}
