"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MaturityLevel, type AdminProfileRow } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminFilterRow } from "@/components/admin/admin-filters";
import { AdminProfileSearch } from "@/components/admin/admin-profile-search";
import { AdminMetricGrid, AdminStatCard } from "@/components/admin/admin-ui";
import { AdminProfilesMobileList } from "@/components/admin/admin-profiles-mobile-list";
import { EditAdminProfileDialog } from "@/components/admin/edit-admin-profile-dialog";
import type { ProfileFormValues } from "@/components/profiles/profile-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";

export default function AdminProfilesPage() {
  const queryClient = useQueryClient();
  const { can } = useAdminPermissions();
  const canManage = can("manage_profiles");
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q.trim(), 250);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState<AdminProfileRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProfileFormValues }) =>
      adminApi.patchProfile(id, {
        name: values.name.trim(),
        avatarKey: values.avatarKey,
        isKids: values.isKids,
        language: values.language,
        audioLanguage: values.audioLanguage,
        subtitleLanguage: values.subtitleLanguage,
        maturityLevel: values.isKids ? MaturityLevel.Kids : values.maturityLevel,
      }),
    onSuccess: async () => {
      setFormError(null);
      setEditProfile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Unable to update profile.");
    },
  });

  const error =
    query.error instanceof ApiError
      ? query.error.message
      : remove.error instanceof ApiError
        ? remove.error.message
        : null;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const kidsOnPage = items.filter((item) => item.isKids).length;

  return (
    <AdminPage
      title="Profiles"
      description="Every profile across accounts. The last profile on an account cannot be deleted."
      error={error}
    >
      <AdminMetricGrid>
        <AdminStatCard
          label="Total profiles"
          value={total}
          hint={qDebounced ? `Filtered · page ${page}/${totalPages}` : `Page ${page} of ${totalPages}`}
        />
        <AdminStatCard label="On this page" value={items.length} hint={`${kidsOnPage} kids profiles`} />
      </AdminMetricGrid>

      <AdminFilterRow>
        <AdminProfileSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search profile, name, or email"
        />
      </AdminFilterRow>

      <div className="lg:hidden">
        <AdminProfilesMobileList
          items={items}
          canManage={canManage}
          onEdit={(profile) => {
            setFormError(null);
            setEditProfile(profile);
          }}
          onDelete={setPendingDelete}
        />
      </div>

      <div className="hidden lg:block">
        <AdminTable columns={["Profile", "Account", "Kids", "PIN", "Maturity", ""]}>
          {items.map((item) => (
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
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFormError(null);
                        setEditProfile(item);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setPendingDelete(item.id)}>
                      Delete
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </div>

      <AdminPagination page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this profile?"
        description="Watch history, lists, and ratings for this profile are removed. This cannot be undone."
        confirmLabel="Delete profile"
        pending={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />

      <EditAdminProfileDialog
        open={Boolean(editProfile)}
        profile={editProfile}
        pending={update.isPending}
        error={formError}
        onClose={() => {
          if (!update.isPending) {
            setEditProfile(null);
            setFormError(null);
          }
        }}
        onSubmit={(values) => {
          if (!editProfile) return;
          setFormError(null);
          update.mutate({ id: editProfile.id, values });
        }}
      />
    </AdminPage>
  );
}
