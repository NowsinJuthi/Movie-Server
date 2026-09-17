"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  HomeRowKind,
  MOVIE_GENRES,
  homeRowKindLabel,
  type AdminHomeRow,
  type AdminLibrary,
  type HomeRowPreset,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type HomeRowFormValues = {
  title: string;
  kind: AdminHomeRow["kind"];
  enabled: boolean;
  collectionId: string;
  libraryId: string;
  genre: string;
  itemIds: string;
};

type CollectionOption = { id: string; name: string; media: "movie" | "series" };

function emptyForm(preset?: HomeRowPreset, library?: Pick<AdminLibrary, "id" | "name">): HomeRowFormValues {
  return {
    title: library?.name ?? preset?.defaultTitle ?? "Featured",
    kind: preset?.kind ?? HomeRowKind.Featured,
    enabled: true,
    collectionId: "",
    libraryId: library?.id ?? "",
    genre: preset?.genre ?? MOVIE_GENRES[0] ?? "action",
    itemIds: "",
  };
}

function fromRow(row: AdminHomeRow): HomeRowFormValues {
  return {
    title: row.title,
    kind: row.kind,
    enabled: row.enabled,
    collectionId: row.collectionId ?? "",
    libraryId: row.libraryId ?? "",
    genre: row.genre ?? MOVIE_GENRES[0] ?? "action",
    itemIds: (row.itemIds ?? []).join(", "),
  };
}

export function HomeRowDialog({
  open,
  mode,
  preset,
  row,
  collections,
  libraries,
  initialLibrary,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  preset?: HomeRowPreset;
  row?: AdminHomeRow | null;
  collections: CollectionOption[];
  libraries: AdminLibrary[];
  initialLibrary?: Pick<AdminLibrary, "id" | "name"> | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: HomeRowFormValues) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<HomeRowFormValues>(() => emptyForm(preset));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && row) {
      setForm(fromRow(row));
    } else {
      setForm(emptyForm(preset, initialLibrary ?? undefined));
    }
  }, [open, mode, preset, row, initialLibrary]);

  if (!mounted || !open) return null;

  const showCollection = form.kind === HomeRowKind.Collection;
  const showLibrary = form.kind === HomeRowKind.Library;
  const showGenre = form.kind === HomeRowKind.Genre;
  const showManual = form.kind === HomeRowKind.Manual;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-row-dialog-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="home-row-dialog-title" className="text-lg font-semibold">
              {mode === "create" ? "Add homepage shelf" : "Edit homepage shelf"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {homeRowKindLabel(form.kind)} · shown on the public home page when enabled.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (showCollection && !form.collectionId.trim()) return;
            if (showLibrary && !form.libraryId.trim()) return;
            onSubmit(form);
          }}
        >
          <div>
            <Label htmlFor="home-row-title">Shelf title</Label>
            <Input
              id="home-row-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </div>

          {mode === "create" && !preset ? (
            <div>
              <Label htmlFor="home-row-kind">Source</Label>
              <select
                id="home-row-kind"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.kind}
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value as AdminHomeRow["kind"] })
                }
              >
                <option value={HomeRowKind.Featured}>Featured</option>
                <option value={HomeRowKind.Trending}>Trending</option>
                <option value={HomeRowKind.PopularMovies}>Popular movies</option>
                <option value={HomeRowKind.PopularSeries}>Popular TV series</option>
                <option value={HomeRowKind.RecentlyAdded}>Recently added</option>
                <option value={HomeRowKind.NewReleases}>New releases</option>
                <option value={HomeRowKind.Library}>Media library</option>
                <option value={HomeRowKind.Collection}>Collection</option>
                <option value={HomeRowKind.Genre}>Genre row</option>
                <option value={HomeRowKind.Manual}>Manual picks</option>
              </select>
            </div>
          ) : null}

          {showLibrary ? (
            <div>
              <Label htmlFor="home-row-library">Media library</Label>
              <select
                id="home-row-library"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.libraryId}
                onChange={(event) => {
                  const library = libraries.find((item) => item.id === event.target.value);
                  setForm({
                    ...form,
                    libraryId: event.target.value,
                    title: form.title.trim() ? form.title : (library?.name ?? form.title),
                  });
                }}
                required
              >
                <option value="">Select library</option>
                {libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name} ({library.kind === "movies" ? "Movies" : "TV"})
                    {!library.enabled ? " · hidden" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {showCollection ? (
            <div>
              <Label htmlFor="home-row-collection">Collection</Label>
              <select
                id="home-row-collection"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.collectionId}
                onChange={(event) => setForm({ ...form, collectionId: event.target.value })}
                required
              >
                <option value="">Select collection</option>
                {collections.some((item) => item.media === "movie") ? (
                  <optgroup label="Movie collections">
                    {collections
                      .filter((item) => item.media === "movie")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
                {collections.some((item) => item.media === "series") ? (
                  <optgroup label="Series collections">
                    {collections
                      .filter((item) => item.media === "series")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
          ) : null}

          {showGenre ? (
            <div>
              <Label htmlFor="home-row-genre">Genre</Label>
              <select
                id="home-row-genre"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.genre}
                onChange={(event) => setForm({ ...form, genre: event.target.value })}
              >
                {MOVIE_GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {showManual ? (
            <div>
              <Label htmlFor="home-row-items">Media IDs</Label>
              <Input
                id="home-row-items"
                value={form.itemIds}
                onChange={(event) => setForm({ ...form, itemIds: event.target.value })}
                placeholder="Comma-separated movie or series ids"
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            Visible on home page
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : mode === "create" ? "Add shelf" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
