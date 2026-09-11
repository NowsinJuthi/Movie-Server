"use client";

import {
  hasMinimumRole,
  MEDIA_ASSET_STATUSES,
  MEDIA_KINDS,
  MOVIE_AVAILABILITIES,
  MOVIE_CERTIFICATIONS,
  MOVIE_GENRES,
  MATURITY_LEVELS,
  PROFILE_LANGUAGES,
  SUBTITLE_FORMATS,
  UserRole,
  VIDEO_RESOLUTIONS,
  languageLabel,
} from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { movieApi } from "@/lib/movie-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { AdminPage } from "@/components/admin/admin-page";

export default function AdminMovieEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState({
    kind: "video",
    quality: "1080p",
    language: "en",
    label: "",
    codec: "",
    channels: "2",
    format: "srt",
    status: "ready",
  });

  const query = useQuery({
    queryKey: ["admin-movie", params.id],
    queryFn: () => movieApi.adminOne(params.id),
    enabled: Boolean(user && hasMinimumRole(user.role, UserRole.Admin) && params.id),
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/admin/movies");
    } else if (user && !hasMinimumRole(user.role, UserRole.Admin)) {
      router.replace("/unauthorized");
    }
  }, [status, user, router]);

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => movieApi.update(params.id, input),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  const addMedia = useMutation({
    mutationFn: () =>
      movieApi.addMedia(params.id, {
        kind: media.kind,
        quality: media.kind === "video" ? media.quality : undefined,
        language: media.language || null,
        label: media.label || null,
        codec: media.codec || null,
        channels: media.kind === "audio" ? Number(media.channels) || null : null,
        format: media.kind === "subtitle" ? media.format : null,
        status: media.status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", params.id] });
    },
  });

  const removeMedia = useMutation({
    mutationFn: (assetId: string) => movieApi.removeMedia(params.id, assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-movie", params.id] });
    },
  });

  if (!user || !hasMinimumRole(user.role, UserRole.Admin)) {
    return <ScreenMessage>Checking access...</ScreenMessage>;
  }
  if (!query.data) {
    return <ScreenMessage>Loading movie...</ScreenMessage>;
  }

  const movie = query.data.movie;

  return (
    <AdminPage
      title={movie.title}
      error={error}
      actions={
        <Button variant="outline" onClick={() => router.push("/admin/movies")}>
          Back
        </Button>
      }
    >
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const trailerUrl = String(data.get("trailerUrl") || "");
            update.mutate({
              title: String(data.get("title")),
              originalTitle: String(data.get("originalTitle") || "") || null,
              description: String(data.get("description")),
              releaseYear: Number(data.get("releaseYear")),
              runtimeMinutes: Number(data.get("runtimeMinutes")),
              ...(trailerUrl.startsWith("http") || trailerUrl === "" ? { trailerUrl: trailerUrl || null } : {}),
              maturityRating: String(data.get("maturityRating")),
              certification: String(data.get("certification") || "") || null,
              availability: String(data.get("availability")),
              published: Boolean(data.get("published")),
              featured: Boolean(data.get("featured")),
              trending: Boolean(data.get("trending")),
              popular: Boolean(data.get("popular")),
              genres: data.getAll("genres"),
              introStartSeconds: Number(data.get("introStartSeconds") || 0) || null,
              introEndSeconds: Number(data.get("introEndSeconds") || 0) || null,
              recapStartSeconds: Number(data.get("recapStartSeconds") || 0) || null,
              recapEndSeconds: Number(data.get("recapEndSeconds") || 0) || null,
              creditsStartSeconds: Number(data.get("creditsStartSeconds") || 0) || null,
            });
          }}
        >
          <Field name="title" label="Title" defaultValue={movie.title} />
          <Field name="originalTitle" label="Original title" defaultValue={movie.originalTitle ?? ""} />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={movie.description}
              className="min-h-24 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
            />
          </div>
          <Field name="releaseYear" label="Year" type="number" defaultValue={String(movie.releaseYear)} />
          <Field name="runtimeMinutes" label="Runtime" type="number" defaultValue={String(movie.runtimeMinutes)} />
          <Field name="trailerUrl" label="Trailer URL (https)" defaultValue={movie.trailerUrl ?? ""} />
          <SelectField name="maturityRating" label="Maturity" options={[...MATURITY_LEVELS]} defaultValue={movie.maturityRating} />
          <SelectField
            name="certification"
            label="Certification"
            options={["", ...MOVIE_CERTIFICATIONS]}
            defaultValue={movie.certification ?? ""}
          />
          <SelectField name="availability" label="Availability" options={[...MOVIE_AVAILABILITIES]} defaultValue={movie.availability} />
          <div className="space-y-2">
            <Label>Genres</Label>
            <select
              name="genres"
              multiple
              defaultValue={movie.genres}
              className="h-24 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
            >
              {MOVIE_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
          <Field
            name="introStartSeconds"
            label="Intro start (s)"
            type="number"
            defaultValue={String(movie.markers?.introStartSeconds ?? "")}
          />
          <Field
            name="introEndSeconds"
            label="Intro end (s)"
            type="number"
            defaultValue={String(movie.markers?.introEndSeconds ?? "")}
          />
          <Field
            name="recapStartSeconds"
            label="Recap start (s)"
            type="number"
            defaultValue={String(movie.markers?.recapStartSeconds ?? "")}
          />
          <Field
            name="recapEndSeconds"
            label="Recap end (s)"
            type="number"
            defaultValue={String(movie.markers?.recapEndSeconds ?? "")}
          />
          <Field
            name="creditsStartSeconds"
            label="Credits start (s)"
            type="number"
            defaultValue={String(movie.markers?.creditsStartSeconds ?? "")}
          />
          <div className="flex flex-wrap gap-4 text-sm md:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="published" defaultChecked={movie.published} /> Publish
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" defaultChecked={movie.featured} /> Featured
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="trending" defaultChecked={movie.trending} /> Trending
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="popular" defaultChecked={movie.popular} /> Popular
            </label>
          </div>
          <Button className="md:col-span-2" type="submit" disabled={update.isPending}>
            Save metadata
          </Button>
        </form>

        <section className="space-y-4">
          <h2 className="text-xl font-medium">Media versions</h2>
          <p className="text-sm text-muted-foreground">
            Register video, audio, and subtitle tracks by opaque storage keys. File paths are never stored in API responses.
          </p>
          <div className="grid gap-3 md:grid-cols-5">
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={media.kind}
              onChange={(e) => setMedia({ ...media, kind: e.target.value })}
            >
              {MEDIA_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={media.quality}
              onChange={(e) => setMedia({ ...media, quality: e.target.value })}
              disabled={media.kind !== "video"}
            >
              {VIDEO_RESOLUTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={media.language}
              onChange={(e) => setMedia({ ...media, language: e.target.value })}
            >
              {PROFILE_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageLabel(code)}
                </option>
              ))}
            </select>
            <Input value={media.label} onChange={(e) => setMedia({ ...media, label: e.target.value })} placeholder="Label" />
            <Input value={media.codec} onChange={(e) => setMedia({ ...media, codec: e.target.value })} placeholder="Codec" />
            <Input
              value={media.channels}
              onChange={(e) => setMedia({ ...media, channels: e.target.value })}
              placeholder="Channels"
              disabled={media.kind !== "audio"}
            />
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={media.format}
              onChange={(e) => setMedia({ ...media, format: e.target.value })}
              disabled={media.kind !== "subtitle"}
            >
              {SUBTITLE_FORMATS.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={media.status}
              onChange={(e) => setMedia({ ...media, status: e.target.value })}
            >
              {MEDIA_ASSET_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => addMedia.mutate()} disabled={addMedia.isPending}>
            Add media track
          </Button>
          <ul className="space-y-2 text-sm">
            {(query.data.assets ?? []).map((asset) => (
              <li key={asset.id} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
                <span>
                  {asset.kind} · {asset.quality ?? languageLabel(asset.language) ?? asset.label} ·{" "}
                  {asset.codec ?? asset.format ?? asset.status}{" "}
                  {asset.channels ? `· ${asset.channels}ch ` : ""}· {asset.storageKey}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeMedia.mutate(asset.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
    </AdminPage>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option || "none"} value={option}>
            {option || "None"}
          </option>
        ))}
      </select>
    </div>
  );
}
