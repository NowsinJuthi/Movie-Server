"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  USER_ROLES,
  UserRole,
  hasMinimumRole,
  isEndUserRole,
  isStaffRole,
  type AdminUserRow,
} from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSelect } from "@/components/admin/admin-filters";
import { AdminUserSearch } from "@/components/admin/admin-user-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AddUserDialog } from "@/components/admin/add-user-dialog";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

function roleLabel(role: string) {
  return role.replaceAll("_", " ");
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  const isSuper = Boolean(user && hasMinimumRole(user.role, UserRole.SuperAdmin));
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q.trim(), 250);
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pendingActive, setPendingActive] = useState<{ id: string; active: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUserRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-users", qDebounced, role, page],
    queryFn: () =>
      adminApi.users({
        q: qDebounced.length >= 1 ? qDebounced : undefined,
        role: role || undefined,
        page,
        limit: 25,
        sort: qDebounced.length >= 1 ? "name" : "newest",
      }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const patch = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.patchUser(id, { isActive }),
    onSuccess: () => {
      setPendingActive(null);
      void refresh();
    },
  });

  const create = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: async () => {
      setFormError(null);
      setAddOpen(false);
      setPage(1);
      await refresh();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Unable to create user.");
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: {
        displayName: string;
        email: string;
        role: UserRole;
        emailVerified: boolean;
        isActive: boolean;
        password?: string;
      };
    }) => adminApi.patchUser(id, input),
    onSuccess: async () => {
      setFormError(null);
      setEditUser(null);
      await refresh();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Unable to update user.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: async () => {
      setPendingDelete(null);
      await refresh();
    },
  });

  const error =
    query.error instanceof ApiError
      ? query.error.message
      : patch.error instanceof ApiError
        ? patch.error.message
        : remove.error instanceof ApiError
          ? remove.error.message
          : null;

  const canManage = (item: AdminUserRow) =>
    isAdmin && (isSuper || isEndUserRole(item.role)) && !(isStaffRole(item.role) && !isSuper);

  return (
    <AdminPage
      title="Users"
      description="Add, edit, delete, and change roles. Staff accounts require Super Admin."
      error={error}
      actions={
        <Button
          onClick={() => {
            setFormError(null);
            setAddOpen(true);
          }}
        >
          Add user
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <AdminUserSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Type 1+ letters — name or email"
        />
        <AdminSelect
          label="Role"
          value={role}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "All" },
            ...USER_ROLES.map((item) => ({ value: item, label: roleLabel(item) })),
          ]}
        />
      </div>
      <AdminTable columns={["Name", "Email", "Role", "Verified", "Active", "Last login", ""]}>
        {(query.data?.items ?? []).map((item) => {
          const manageable = canManage(item);
          const isSelf = user?.id === item.id;

          return (
            <tr key={item.id}>
              <AdminTd>{item.displayName}</AdminTd>
              <AdminTd>{item.email}</AdminTd>
              <AdminTd className="capitalize">{roleLabel(item.role)}</AdminTd>
              <AdminTd>{item.emailVerified ? "Yes" : "No"}</AdminTd>
              <AdminTd>{item.isActive ? "Yes" : "No"}</AdminTd>
              <AdminTd>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "—"}</AdminTd>
              <AdminTd>
                <div className="flex flex-wrap gap-2">
                  {manageable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFormError(null);
                        setEditUser(item);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {manageable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPendingActive({ id: item.id, active: item.isActive })}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                  {manageable && !isSelf ? (
                    <Button size="sm" variant="destructive" onClick={() => setPendingDelete(item)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </AdminTd>
            </tr>
          );
        })}
      </AdminTable>
      <AdminPagination page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />

      <ConfirmDialog
        open={Boolean(pendingActive)}
        title={pendingActive?.active ? "Deactivate this user?" : "Activate this user?"}
        description={
          pendingActive?.active
            ? "They will be signed out of every device immediately."
            : "The account will be able to sign in again."
        }
        confirmLabel={pendingActive?.active ? "Deactivate" : "Activate"}
        pending={patch.isPending}
        onClose={() => setPendingActive(null)}
        onConfirm={() =>
          pendingActive && patch.mutate({ id: pendingActive.id, isActive: !pendingActive.active })
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this user?"
        description={
          pendingDelete
            ? `Permanently delete ${pendingDelete.displayName} (${pendingDelete.email}). Profiles and sessions will be removed.`
            : ""
        }
        confirmLabel="Delete"
        pending={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />

      <AddUserDialog
        open={addOpen}
        pending={create.isPending}
        error={formError}
        allowStaffRoles={isSuper}
        onClose={() => {
          if (!create.isPending) {
            setAddOpen(false);
            setFormError(null);
          }
        }}
        onSubmit={(values) => {
          setFormError(null);
          create.mutate({
            email: values.email.trim(),
            displayName: values.displayName.trim(),
            password: values.password,
            role: values.role,
            emailVerified: values.emailVerified,
          });
        }}
      />

      <EditUserDialog
        open={Boolean(editUser)}
        user={editUser}
        pending={update.isPending}
        error={formError}
        allowStaffRoles={isSuper}
        onClose={() => {
          if (!update.isPending) {
            setEditUser(null);
            setFormError(null);
          }
        }}
        onSubmit={(values) => {
          if (!editUser) return;
          setFormError(null);
          const password = values.password.trim();
          update.mutate({
            id: editUser.id,
            input: {
              displayName: values.displayName.trim(),
              email: values.email.trim(),
              role: values.role,
              emailVerified: values.emailVerified,
              isActive: values.isActive,
              ...(password ? { password } : {}),
            },
          });
        }}
      />
    </AdminPage>
  );
}
