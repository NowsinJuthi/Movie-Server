"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { USER_ROLES, UserRole, hasMinimumRole } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSearch, AdminSelect } from "@/components/admin/admin-filters";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuper = Boolean(user && hasMinimumRole(user.role, UserRole.SuperAdmin));
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ id: string; active: boolean } | null>(null);

  const query = useQuery({
    queryKey: ["admin-users", q, role, page],
    queryFn: () =>
      adminApi.users({
        q: q || undefined,
        role: role || undefined,
        page,
        limit: 25,
        sort: "newest",
      }),
  });

  const patch = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.patchUser(id, { isActive }),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const roleMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: UserRole }) => adminApi.updateRole(id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const error =
    query.error instanceof ApiError
      ? query.error.message
      : patch.error instanceof ApiError
        ? patch.error.message
        : roleMut.error instanceof ApiError
          ? roleMut.error.message
          : null;

  return (
    <AdminPage title="Users" description="Search, filter, and deactivate accounts. Role changes require Super Admin." error={error}>
      <div className="mb-4 flex flex-wrap gap-3">
        <AdminSearch value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder="Search name or email" />
        <AdminSelect
          label="Role"
          value={role}
          onChange={(value) => { setRole(value); setPage(1); }}
          options={[{ value: "", label: "All" }, ...USER_ROLES.map((item) => ({ value: item, label: item.replace("_", " ") }))]}
        />
      </div>
      <AdminTable columns={["Name", "Email", "Role", "Verified", "Active", "Last login", ""]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd>{item.displayName}</AdminTd>
            <AdminTd>{item.email}</AdminTd>
            <AdminTd className="capitalize">
              {isSuper ? (
                <select
                  className="rounded-md border border-input bg-background px-2 py-1"
                  value={item.role}
                  onChange={(event) => roleMut.mutate({ id: item.id, next: event.target.value as UserRole })}
                >
                  {USER_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option.replace("_", " ")}
                    </option>
                  ))}
                </select>
              ) : (
                item.role.replace("_", " ")
              )}
            </AdminTd>
            <AdminTd>{item.emailVerified ? "Yes" : "No"}</AdminTd>
            <AdminTd>{item.isActive ? "Yes" : "No"}</AdminTd>
            <AdminTd>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "—"}</AdminTd>
            <AdminTd>
              <Button size="sm" variant="secondary" onClick={() => setPending({ id: item.id, active: item.isActive })}>
                {item.isActive ? "Deactivate" : "Activate"}
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.active ? "Deactivate this user?" : "Activate this user?"}
        description={
          pending?.active
            ? "They will be signed out of every device immediately."
            : "The account will be able to sign in again."
        }
        confirmLabel={pending?.active ? "Deactivate" : "Activate"}
        pending={patch.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && patch.mutate({ id: pending.id, isActive: !pending.active })}
      />
    </AdminPage>
  );
}
