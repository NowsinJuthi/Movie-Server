"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  UserRole,
  assignableRoleOptions,
  hasMinimumRole,
  isEndUserRole,
  isStaffRole,
  parseAssignableRole,
  userRoleDisplayLabel,
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
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { cn } from "@/lib/utils";

function subscriptionStatusClass(status: string) {
  switch (status) {
    case "active":
    case "trial":
      return "text-emerald-400";
    case "pending":
      return "text-amber-400";
    case "suspended":
      return "text-red-400";
    case "cancelled":
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { can } = useAdminPermissions();
  const isAdmin = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  const isSuper = Boolean(user && hasMinimumRole(user.role, UserRole.SuperAdmin));
  const canManageUsers = can("manage_users");
  const canViewSubscriptions = can("view_subscriptions") || can("manage_subscriptions");
  const canManageSubscriptions = can("manage_subscriptions");
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q.trim(), 250);
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pendingActive, setPendingActive] = useState<{ id: string; active: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUserRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const roleQuery = roleFilter ? parseAssignableRole(roleFilter) : null;

  const query = useQuery({
    queryKey: ["admin-users", qDebounced, roleFilter, page],
    queryFn: () =>
      adminApi.users({
        q: qDebounced.length >= 1 ? qDebounced : undefined,
        role: roleQuery?.role,
        staffProfileId: roleQuery?.staffProfileId ?? undefined,
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
        staffProfileId?: string;
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
        canManageUsers ? (
          <Button
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
          >
            Add user
          </Button>
        ) : null
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
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "All" },
            ...assignableRoleOptions(isSuper).map((item) => ({
              value: item.value,
              label: `${item.group === "Staff roles" ? "Staff · " : ""}${item.label}`,
            })),
          ]}
        />
      </div>
      <AdminTable
        columns={[
          "Name",
          "Email",
          "Role",
          ...(canViewSubscriptions ? (["Subscription"] as const) : []),
          "Verified",
          "Active",
          "Last login",
          "",
        ]}
      >
        {(query.data?.items ?? []).map((item) => {
          const manageable = canManage(item);
          const isSelf = user?.id === item.id;

          return (
            <tr key={item.id}>
              <AdminTd>{item.displayName}</AdminTd>
              <AdminTd>{item.email}</AdminTd>
              <AdminTd>{userRoleDisplayLabel(item)}</AdminTd>
              {canViewSubscriptions ? (
                <AdminTd>
                  {item.subscription ? (
                    <div className="min-w-[140px] space-y-1">
                      <p className="font-medium">{item.subscription.planName}</p>
                      <p className={cn("text-xs capitalize", subscriptionStatusClass(item.subscription.status))}>
                        {item.subscription.status}
                        {!item.subscription.entitled ? " · not entitled" : ""}
                      </p>
                      {canManageSubscriptions ? (
                        <Link
                          href={`/admin/subscriptions?userId=${encodeURIComponent(item.id)}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Manage
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </AdminTd>
              ) : null}
              <AdminTd>{item.emailVerified ? "Yes" : "No"}</AdminTd>
              <AdminTd>{item.isActive ? "Yes" : "No"}</AdminTd>
              <AdminTd>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "—"}</AdminTd>
              <AdminTd>
                <div className="flex flex-wrap gap-2">
                  {manageable && canManageUsers ? (
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
                  {canViewSubscriptions && item.subscription && canManageSubscriptions ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/subscriptions?userId=${encodeURIComponent(item.id)}`}>
                        Subscription
                      </Link>
                    </Button>
                  ) : null}
                  {manageable && canManageUsers ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPendingActive({ id: item.id, active: item.isActive })}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                  {manageable && canManageUsers && !isSelf ? (
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
          const assignment = parseAssignableRole(values.assignableRole);
          create.mutate({
            email: values.email.trim(),
            displayName: values.displayName.trim(),
            password: values.password,
            role: assignment.role,
            staffProfileId: assignment.staffProfileId,
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
          const assignment = parseAssignableRole(values.assignableRole);
          update.mutate({
            id: editUser.id,
            input: {
              displayName: values.displayName.trim(),
              email: values.email.trim(),
              role: assignment.role,
              staffProfileId: assignment.staffProfileId ?? undefined,
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
