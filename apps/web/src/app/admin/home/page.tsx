"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HOME_ROW_KINDS, HomeRowKind } from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, AdminTd } from "@/components/admin/admin-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminHomePage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "Featured", kind: HomeRowKind.Featured, sortOrder: 0 });
  const hero = useQuery({ queryKey: ["admin-home-hero"], queryFn: adminApi.homeHero });
  const rows = useQuery({ queryKey: ["admin-home-rows"], queryFn: adminApi.homeRows });
  const saveHero = useMutation({
    mutationFn: adminApi.updateHomeHero,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-hero"] }),
  });
  const create = useMutation({
    mutationFn: () => adminApi.createHomeRow(form),
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

  return (
    <AdminPage title="Homepage" description="Override the hero and add ordered rows. Personalized rows still appear first for each profile." error={error}>
      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Hero banner</h2>
        <p className="mb-4 text-sm text-muted-foreground">Leave the media id empty to use the automatic featured/trending fallback.</p>
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
            onChange={(event) => saveHero.mutate({ mediaKind: (event.target.value || null) as "movie" | "series" | null })}
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
        className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <Label htmlFor="row-title">Row title</Label>
          <Input id="row-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div>
          <Label htmlFor="row-kind">Source</Label>
          <select
            id="row-kind"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value as typeof form.kind })}
          >
            {HOME_ROW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="row-order">Order</Label>
          <Input id="row-order" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
        </div>
        <Button className="self-end" disabled={create.isPending}>
          Add row
        </Button>
      </form>
      <AdminTable columns={["Order", "Title", "Kind", "Enabled", ""]}>
        {(rows.data?.rows ?? []).map((row, index, list) => (
          <tr key={row.id}>
            <AdminTd>{row.sortOrder}</AdminTd>
            <AdminTd>{row.title}</AdminTd>
            <AdminTd>{row.kind.replaceAll("_", " ")}</AdminTd>
            <AdminTd>{row.enabled ? "Yes" : "No"}</AdminTd>
            <AdminTd className="space-x-2">
              <Button size="sm" variant="outline" disabled={index === 0} onClick={() => move.mutate({ id: row.id, sortOrder: (list[index - 1]?.sortOrder ?? 0) - 1 })}>
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
