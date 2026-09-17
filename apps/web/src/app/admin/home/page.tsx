"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HOME_ROW_KINDS, HomeRowKind } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";
import { seriesApi } from "@/lib/series-api";

type HomeRowForm = {
  title: string;
  kind: (typeof HOME_ROW_KINDS)[number];
  sortOrder: number;
  collectionId: string;
};

function rowKindLabel(kind: string) {
  return kind.replaceAll("_", " ");
}

export default function AdminHomePage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [form, setForm] = useState<HomeRowForm>({
    title: "Featured",
    kind: HomeRowKind.Featured,
    sortOrder: 0,
    collectionId: "",
  });
  const hero = useQuery({ queryKey: ["admin-home-hero"], queryFn: adminApi.homeHero });
  const rows = useQuery({ queryKey: ["admin-home-rows"], queryFn: adminApi.homeRows });
  const movieCollections = useQuery({
    queryKey: ["admin-movie-collections"],
    queryFn: movieApi.adminCollections,
  });
  const seriesCollections = useQuery({
    queryKey: ["admin-series-collections"],
    queryFn: seriesApi.adminCollections,
  });

  const collectionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const collection of movieCollections.data?.collections ?? []) {
      labels.set(collection.id, `Movie · ${collection.name}`);
    }
    for (const collection of seriesCollections.data?.collections ?? []) {
      labels.set(collection.id, `Series · ${collection.name}`);
    }
    return labels;
  }, [movieCollections.data?.collections, seriesCollections.data?.collections]);

  const saveHero = useMutation({
    mutationFn: adminApi.updateHomeHero,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-hero"] }),
  });
  const create = useMutation({
    mutationFn: () =>
      adminApi.createHomeRow({
        title: form.title,
        kind: form.kind,
        sortOrder: form.sortOrder,
        collectionId:
          form.kind === HomeRowKind.Collection ? form.collectionId.trim() || null : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-rows"] }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminApi.updateHomeRow(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-rows"] }),
  });
  const move = useMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) => adminApi.updateHomeRow(id, { sortOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-rows"] }),
  });
  const remove = useMutation({
    mutationFn: adminApi.deleteHomeRow,
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-home-rows"] });
    },
  });
  const error =
    hero.error instanceof ApiError
      ? hero.error.message
      : rows.error instanceof ApiError
        ? rows.error.message
        : create.error instanceof ApiError
          ? create.error.message
          : saveHero.error instanceof ApiError
            ? saveHero.error.message
            : remove.error instanceof ApiError
              ? remove.error.message
              : null;
  const heroData = hero.data?.hero;
  const showCollectionPicker = form.kind === HomeRowKind.Collection;

  return (
    <AdminPage
      title="Homepage"
      description="Override the hero and add ordered rows. Use collection rows to surface movie or series collections on the home page."
      error={error}
    >
      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Hero banner</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Leave the media id empty to use the automatic featured/trending fallback.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(heroData?.enabled)}
              onChange={(event) => saveHero.mutate({ enabled: event.target.checked })}
            />
            Enabled
          </label>
          <select
            className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
            value={heroData?.mediaKind ?? ""}
            onChange={(event) =>
              saveHero.mutate({ mediaKind: (event.target.value || null) as "movie" | "series" | null })
            }
          >
            <option value="">Kind</option>
            <option value="movie">Movie</option>
            <option value="series">Series</option>
          </select>
          <Input
            placeholder="Movie or series id"
            defaultValue={heroData?.mediaId ?? ""}
            onBlur={(event) => saveHero.mutate({ mediaId: event.target.value || null })}
          />
          <Input
            placeholder="Title override"
            defaultValue={heroData?.titleOverride ?? ""}
            onBlur={(event) => saveHero.mutate({ titleOverride: event.target.value || null })}
          />
        </div>
      </section>
      <form
        className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (showCollectionPicker && !form.collectionId.trim()) return;
          create.mutate();
        }}
      >
        <div>
          <Label htmlFor="row-title">Row title</Label>
          <Input
            id="row-title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="row-kind">Source</Label>
          <select
            id="row-kind"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
            value={form.kind}
            onChange={(event) =>
              setForm({
                ...form,
                kind: event.target.value as HomeRowForm["kind"],
                collectionId: "",
              })
            }
          >
            {HOME_ROW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {rowKindLabel(kind)}
              </option>
            ))}
          </select>
        </div>
        {showCollectionPicker ? (
          <div className="md:col-span-2">
            <Label htmlFor="row-collection">Collection</Label>
            <select
              id="row-collection"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
              value={form.collectionId}
              onChange={(event) => setForm({ ...form, collectionId: event.target.value })}
              required
            >
              <option value="">Select a collection</option>
              {(movieCollections.data?.collections ?? []).length > 0 ? (
                <optgroup label="Movie collections">
                  {(movieCollections.data?.collections ?? []).map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {(seriesCollections.data?.collections ?? []).length > 0 ? (
                <optgroup label="Series collections">
                  {(seriesCollections.data?.collections ?? []).map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage collections under Homepage → Movie collections / Series collections.
            </p>
          </div>
        ) : null}
        <div>
          <Label htmlFor="row-order">Order</Label>
          <Input
            id="row-order"
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
          />
        </div>
        <Button
          className="self-end"
          disabled={create.isPending || (showCollectionPicker && !form.collectionId.trim())}
        >
          Add row
        </Button>
      </form>
      <AdminTable columns={["Order", "Title", "Kind", "Collection", "Enabled", ""]}>
        {(rows.data?.rows ?? []).map((row, index, list) => (
          <tr key={row.id}>
            <AdminTd>{row.sortOrder}</AdminTd>
            <AdminTd>{row.title}</AdminTd>
            <AdminTd>{rowKindLabel(row.kind)}</AdminTd>
            <AdminTd>
              {row.collectionId
                ? (collectionLabels.get(row.collectionId) ?? row.collectionId)
                : "—"}
            </AdminTd>
            <AdminTd>{row.enabled ? "Yes" : "No"}</AdminTd>
            <AdminTd className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => move.mutate({ id: row.id, sortOrder: (list[index - 1]?.sortOrder ?? 0) - 1 })}
              >
                Up
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}>
                {row.enabled ? "Hide" : "Show"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPending(row.id)}>
                Delete
              </Button>
            </AdminTd>
          </tr>
        ))}
      </AdminTable>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Remove this homepage row?"
        description="The browse page will stop showing this shelf after the next cache refresh."
        confirmLabel="Delete row"
        pending={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending)}
      />
    </AdminPage>
  );
}
