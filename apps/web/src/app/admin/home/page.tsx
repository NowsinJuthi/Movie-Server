"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  HardDrive,
  Layers3,
  MonitorPlay,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  HOME_AUTO_PERSONALIZED_ROW_PRESETS,
  HOME_LAYOUT_ROW_PRESETS,
  HOME_LIBRARY_ROW_PRESET,
  HOME_PERSONALIZED_ROW_PRESETS,
  HomeRowKind,
  genreDisplayName,
  homeRowKindLabel,
  homeRowPreset,
  homeRowPresetKey,
  type AdminHomeRow,
  type AdminLibrary,
  type HomeRowPreset,
} from "@movie-server/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { HomeRowDialog, type HomeRowFormValues } from "@/components/admin/home-row-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { libraryApi } from "@/lib/library-api";
import { movieApi } from "@/lib/movie-api";
import { seriesApi } from "@/lib/series-api";
import styles from "./home-page.module.css";

function rowPayload(values: HomeRowFormValues) {
  return {
    title: values.title.trim(),
    kind: values.kind,
    enabled: values.enabled,
    collectionId: values.kind === HomeRowKind.Collection ? values.collectionId.trim() || null : null,
    libraryId: values.kind === HomeRowKind.Library ? values.libraryId.trim() || null : null,
    genre: values.kind === HomeRowKind.Genre ? values.genre.trim() || null : null,
    itemIds:
      values.kind === HomeRowKind.Manual
        ? values.itemIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
  };
}

function rowDetail(
  row: AdminHomeRow,
  collectionLabels: Map<string, string>,
  libraryLabels: Map<string, string>,
) {
  if (row.kind === HomeRowKind.Library && row.libraryId) {
    return libraryLabels.get(row.libraryId) ?? row.libraryId;
  }
  if (row.kind === HomeRowKind.Collection && row.collectionId) {
    return collectionLabels.get(row.collectionId) ?? row.collectionId;
  }
  if (row.kind === HomeRowKind.Genre && row.genre) {
    return `Genre · ${genreDisplayName(row.genre)}`;
  }
  if (row.kind === HomeRowKind.Manual && row.itemIds.length > 0) {
    return `${row.itemIds.length} hand-picked titles`;
  }
  return homeRowPreset(row.kind)?.description ?? "Catalog shelf";
}

export default function AdminHomePage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<AdminHomeRow | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [dialogPreset, setDialogPreset] = useState<HomeRowPreset | undefined>();
  const [editRow, setEditRow] = useState<AdminHomeRow | null>(null);
  const [initialLibrary, setInitialLibrary] = useState<Pick<AdminLibrary, "id" | "name"> | null>(null);

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
  const mediaLibraries = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: libraryApi.list,
  });

  const sortedRows = useMemo(
    () => [...(rows.data?.rows ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [rows.data?.rows],
  );

  const collectionOptions = useMemo(
    () => [
      ...(movieCollections.data?.collections ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        media: "movie" as const,
      })),
      ...(seriesCollections.data?.collections ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        media: "series" as const,
      })),
    ],
    [movieCollections.data?.collections, seriesCollections.data?.collections],
  );

  const collectionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of collectionOptions) {
      labels.set(item.id, `${item.media === "movie" ? "Movie" : "Series"} · ${item.name}`);
    }
    return labels;
  }, [collectionOptions]);

  const libraryOptions = useMemo(
    () => [...(mediaLibraries.data?.libraries ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [mediaLibraries.data?.libraries],
  );

  const libraryLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const library of libraryOptions) {
      labels.set(
        library.id,
        `${library.kind === "movies" ? "Movies" : "TV"} · ${library.name}${library.enabled ? "" : " (hidden)"}`,
      );
    }
    return labels;
  }, [libraryOptions]);

  const configuredPresetKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of sortedRows) {
      if (row.kind === HomeRowKind.Genre && row.genre) {
        keys.add(`genre:${row.genre}`);
      } else {
        keys.add(row.kind);
      }
    }
    return keys;
  }, [sortedRows]);
  const configuredLibraryIds = useMemo(
    () =>
      new Set(
        sortedRows
          .filter((row) => row.kind === HomeRowKind.Library && row.libraryId)
          .map((row) => row.libraryId!),
      ),
    [sortedRows],
  );

  const stats = useMemo(() => {
    const active = sortedRows.filter((row) => row.enabled).length;
    return {
      total: sortedRows.length,
      active,
      hidden: sortedRows.length - active,
      layoutAvailable: HOME_LAYOUT_ROW_PRESETS.filter(
        (preset) => !configuredPresetKeys.has(homeRowPresetKey(preset)),
      ).length,
      librariesAvailable: libraryOptions.filter(
        (library) => library.enabled && !configuredLibraryIds.has(library.id),
      ).length,
    };
  }, [sortedRows, configuredPresetKeys, libraryOptions, configuredLibraryIds]);

  const invalidateRows = () => queryClient.invalidateQueries({ queryKey: ["admin-home-rows"] });

  const saveHero = useMutation({
    mutationFn: adminApi.updateHomeHero,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-home-hero"] }),
  });
  const create = useMutation({
    mutationFn: (values: HomeRowFormValues) => adminApi.createHomeRow(rowPayload(values)),
    onSuccess: async () => {
      setDialogMode(null);
      setDialogPreset(undefined);
      await invalidateRows();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: HomeRowFormValues }) =>
      adminApi.updateHomeRow(id, rowPayload(values)),
    onSuccess: async () => {
      setDialogMode(null);
      setEditRow(null);
      await invalidateRows();
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminApi.updateHomeRow(id, { enabled }),
    onSuccess: invalidateRows,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderHomeRows(ids),
    onSuccess: invalidateRows,
  });
  const seedLayout = useMutation({
    mutationFn: adminApi.seedHomeLayoutRows,
    onSuccess: invalidateRows,
  });
  const seedLibraries = useMutation({
    mutationFn: adminApi.seedHomeLibraryRows,
    onSuccess: invalidateRows,
  });
  const remove = useMutation({
    mutationFn: adminApi.deleteHomeRow,
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidateRows();
    },
  });

  const error =
    hero.error instanceof ApiError
      ? hero.error.message
      : rows.error instanceof ApiError
        ? rows.error.message
        : create.error instanceof ApiError
          ? create.error.message
          : update.error instanceof ApiError
            ? update.error.message
            : seedLayout.error instanceof ApiError
                ? seedLayout.error.message
                : seedLibraries.error instanceof ApiError
                ? seedLibraries.error.message
                : remove.error instanceof ApiError
                ? remove.error.message
                : saveHero.error instanceof ApiError
                  ? saveHero.error.message
                  : null;

  const heroData = hero.data?.hero;
  const dialogBusy = create.isPending || update.isPending;

  function openCreate(preset?: HomeRowPreset, library?: Pick<AdminLibrary, "id" | "name">) {
    setEditRow(null);
    setDialogPreset(preset);
    setInitialLibrary(library ?? null);
    setDialogMode("create");
  }

  function openEdit(row: AdminHomeRow) {
    setDialogPreset(undefined);
    setInitialLibrary(null);
    setEditRow(row);
    setDialogMode("edit");
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sortedRows.length) return;
    const next = [...sortedRows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    reorder.mutate(next.map((row) => row.id));
  }

  function presetDisabled(preset: HomeRowPreset) {
    if (
      preset.kind === HomeRowKind.Collection ||
      preset.kind === HomeRowKind.Manual ||
      preset.kind === HomeRowKind.Library
    ) {
      return false;
    }
    if (preset.kind === HomeRowKind.Genre && preset.genre) {
      return configuredPresetKeys.has(homeRowPresetKey(preset));
    }
    return configuredPresetKeys.has(homeRowPresetKey(preset));
  }

  return (
    <AdminPage
      title="Homepage layout"
      description="Manage the shelves viewers see on the home page. Add catalog lists, media libraries, collections, and control their order."
      error={error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={seedLayout.isPending || stats.layoutAvailable === 0}
            onClick={() => seedLayout.mutate()}
          >
            <Layers3 className="mr-1.5 h-3.5 w-3.5" />
            {seedLayout.isPending ? "Adding..." : "Add homepage shelves"}
          </Button>
          <Button type="button" size="sm" onClick={() => openCreate()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Custom shelf
          </Button>
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Configured shelves</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Visible</span>
            <span className={styles.statValue}>{stats.active}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Hidden</span>
            <span className={styles.statValue}>{stats.hidden}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Shelves to add</span>
            <span className={styles.statValue}>{stats.layoutAvailable}</span>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Standard homepage shelves</h2>
              <p className={styles.panelHint}>
                Featured, Trending, Recommended, Recently Added, New Releases, and top genre rows.
                Click to add — remove from the list above.
              </p>
            </div>
          </div>
          <div className={styles.presetGrid}>
            {HOME_LAYOUT_ROW_PRESETS.map((preset) => (
              <button
                key={homeRowPresetKey(preset)}
                type="button"
                className={styles.presetCard}
                disabled={presetDisabled(preset)}
                onClick={() => openCreate(preset)}
              >
                <p className={styles.presetLabel}>{preset.defaultTitle}</p>
                <p className={styles.presetDescription}>
                  {presetDisabled(preset) ? "On homepage — delete above to remove" : preset.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.heroPanel}>
          <div className="mb-3 flex items-center gap-2">
            <MonitorPlay className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Hero banner</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Leave the media id empty to use automatic featured/trending fallback.
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

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Homepage shelves</h2>
              <p className={styles.panelHint}>
                These rows appear on the public home page in the order shown below.
              </p>
            </div>
          </div>
          {sortedRows.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No shelves configured yet.</p>
              <p className="mt-2">Use <strong>Add homepage shelves</strong> to load Featured, Trending, genres, and more.</p>
            </div>
          ) : (
            <div className={styles.shelfList}>
              {sortedRows.map((row, index) => (
                <article key={row.id} className={styles.shelfRow}>
                  <span className={styles.orderBadge}>{index + 1}</span>
                  <div>
                    <p className={styles.shelfTitle}>{row.title}</p>
                    <p className={styles.shelfMeta}>
                      {homeRowKindLabel(row.kind)} · {rowDetail(row, collectionLabels, libraryLabels)}
                    </p>
                  </div>
                  <div className={styles.shelfActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => moveRow(index, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === sortedRows.length - 1 || reorder.isPending}
                      onClick={() => moveRow(index, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}>
                      {row.enabled ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPendingDelete(row)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Media libraries</h2>
              <p className={styles.panelHint}>
                Show scanned library folders as homepage shelves. Each library can appear once.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={seedLibraries.isPending || stats.librariesAvailable === 0}
              onClick={() => seedLibraries.mutate()}
            >
              <HardDrive className="mr-1.5 h-3.5 w-3.5" />
              {seedLibraries.isPending ? "Adding..." : "Add all libraries"}
            </Button>
          </div>
          {libraryOptions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No media libraries yet.</p>
              <p className="mt-2">Create libraries under Catalog → Libraries, then add them here.</p>
            </div>
          ) : (
            <div className={styles.presetGrid}>
              {libraryOptions.map((library) => {
                const onHomepage = configuredLibraryIds.has(library.id);
                return (
                  <button
                    key={library.id}
                    type="button"
                    className={styles.presetCard}
                    disabled={onHomepage || !library.enabled}
                    onClick={() => openCreate(HOME_LIBRARY_ROW_PRESET, library)}
                  >
                    <p className={styles.presetLabel}>{library.name}</p>
                    <p className={styles.presetDescription}>
                      {!library.enabled
                        ? "Library is hidden — enable it first"
                        : onHomepage
                          ? "Already on homepage"
                          : `${library.kind === "movies" ? "Movies" : "TV"} · ${library.itemCount} titles`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Profile shelves</h2>
              <p className={styles.panelHint}>
                Optional personalized rows you can add or remove. Watch history rows stay automatic.
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className={styles.presetGrid}>
            {HOME_PERSONALIZED_ROW_PRESETS.map((preset) => (
              <button
                key={homeRowPresetKey(preset)}
                type="button"
                className={styles.presetCard}
                disabled={presetDisabled(preset)}
                onClick={() => openCreate(preset)}
              >
                <p className={styles.presetLabel}>{preset.label}</p>
                <p className={styles.presetDescription}>
                  {presetDisabled(preset) ? "On homepage — delete above to remove" : preset.description}
                </p>
              </button>
            ))}
          </div>
          <div className={`${styles.personalizedList} mt-4`}>
            {HOME_AUTO_PERSONALIZED_ROW_PRESETS.map((preset) => (
              <div key={preset.kind} className={styles.personalizedItem}>
                <p className={styles.presetLabel}>{preset.label}</p>
                <p className={styles.presetDescription}>{preset.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <HomeRowDialog
        open={dialogMode !== null}
        mode={dialogMode === "edit" ? "edit" : "create"}
        preset={dialogPreset}
        row={editRow}
        collections={collectionOptions}
        libraries={libraryOptions}
        initialLibrary={initialLibrary}
        busy={dialogBusy}
        onClose={() => {
          setDialogMode(null);
          setEditRow(null);
          setDialogPreset(undefined);
          setInitialLibrary(null);
        }}
        onSubmit={(values) => {
          if (dialogMode === "edit" && editRow) {
            update.mutate({ id: editRow.id, values });
          } else {
            create.mutate({
              ...values,
              title: values.title || dialogPreset?.defaultTitle || "Shelf",
            });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Remove “${pendingDelete?.title ?? "shelf"}”?`}
        description="This shelf will disappear from the homepage after the layout cache refreshes."
        confirmLabel="Delete shelf"
        pending={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </AdminPage>
  );
}
