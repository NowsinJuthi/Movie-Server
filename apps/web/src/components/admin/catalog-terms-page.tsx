"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AdminCatalogTerm } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { AdminSearch } from "@/components/admin/admin-filters";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export function CatalogTermsPage({
  kind,
  title,
  description,
}: {
  kind: "genres" | "tags";
  title: string;
  description: string;
}) {
  const queryClient = useQueryClient();
  const key = ["admin-catalog", kind];
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<AdminCatalogTerm | null>(null);
  const query = useQuery({
    queryKey: [...key, q],
    queryFn: () => (kind === "genres" ? adminApi.genres(q || undefined) : adminApi.tags(q || undefined)),
  });
  const create = useMutation({
    mutationFn: () => adminApi.createTerm(kind, name),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminApi.updateTerm(kind, id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteTerm(kind, id),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const error =
    query.error instanceof ApiError
      ? query.error.message
      : create.error instanceof ApiError
        ? create.error.message
        : update.error instanceof ApiError
          ? update.error.message
          : remove.error instanceof ApiError
            ? remove.error.message
            : null;

  return (
    <AdminPage title={title} description={description} error={error}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={`New ${kind.slice(0, -1)}`} maxLength={40} />
        <Button disabled={create.isPending}>Add</Button>
        <AdminSearch value={q} onChange={setQ} placeholder="Filter" />
      </form>
      <AdminTable columns={["Name", "Slug", "Used on", "Enabled", ""]}>
        {(query.data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <AdminTd className="capitalize">{item.name}</AdminTd>
            <AdminTd>{item.slug}</AdminTd>
            <AdminTd>{item.usageCount}</AdminTd>
            <AdminTd>{item.enabled ? "Yes" : "No"}</AdminTd>
            <AdminTd className="space-x-2">
              <Button size="sm" variant="outline" onClick={() => update.mutate({ id: item.id, enabled: !item.enabled })}>
                {item.enabled ? "Disable" : "Enable"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPending(item)}>
                Delete
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <ConfirmDialog
        open={Boolean(pending)}
        title={`Delete ${pending?.name}?`}
        description="Terms that are still attached to titles cannot be deleted. Disable them instead."
        confirmLabel="Delete"
        pending={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending.id)}
      />
    </AdminPage>
  );
}
