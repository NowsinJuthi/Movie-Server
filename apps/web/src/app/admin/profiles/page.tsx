"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminProfileSearch } from "@/components/admin/admin-profile-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminProfilesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q.trim(), 250);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-profiles", qDebounced, page],
    queryFn: () =>
      adminApi.profiles({
        q: qDebounced.length >= 1 ? qDebounced : undefined,
        page,
        limit: 25,
      }),
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
        <AdminProfileSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Type 1+ letters — profile, name, or email"
        />
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
