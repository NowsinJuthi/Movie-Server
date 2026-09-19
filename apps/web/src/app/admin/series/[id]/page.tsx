"use client";

import { hasMinimumRole, MEDIA_ASSET_STATUSES, MEDIA_KINDS, PROFILE_LANGUAGES, SUBTITLE_FORMATS, UserRole, VIDEO_RESOLUTIONS, languageLabel } from "@movie-server/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { seriesApi } from "@/lib/series-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { AdminPage } from "@/components/admin/admin-page";

export default function AdminSeriesEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("Pilot");
  const [selectedSeasonId, setSelectedSeason] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState("video");
  const [mediaQuality, setMediaQuality] = useState("1080p");
  const [mediaLanguage, setMediaLanguage] = useState("en");
  const [mediaCodec, setMediaCodec] = useState("");
  const [mediaChannels, setMediaChannels] = useState("2");
  const [mediaFormat, setMediaFormat] = useState("srt");
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-series-one", params.id],
    queryFn: () => seriesApi.adminOne(params.id),
    enabled: Boolean(user && hasMinimumRole(user.role, UserRole.Admin)),
  });
  const selectedSeason = selectedSeasonId ?? query.data?.seasons[0]?.id ?? null;

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/admin/series");
    else if (user && !hasMinimumRole(user.role, UserRole.Admin)) router.replace("/unauthorized");
  }, [status, user, router]);

  const seasonQuery = useQuery({
    queryKey: ["admin-season", params.id, selectedSeason],
    queryFn: () => seriesApi.adminSeason(params.id, selectedSeason!),
    enabled: Boolean(selectedSeason),
  });

  const publish = useMutation({
    mutationFn: () => seriesApi.update(params.id, { published: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-series-one", params.id] });
    },
  });

  const addSeason = useMutation({
    mutationFn: () => seriesApi.createSeason(params.id, { seasonNumber, published: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-series-one", params.id] });
    },
  });

  const addEpisode = useMutation({
    mutationFn: () =>
      seriesApi.createEpisode(params.id, selectedSeason!, {
        episodeNumber,
        title: episodeTitle,
        description: `${episodeTitle} episode description.`,
        runtimeMinutes: 42,
        published: true,
      }),
    onSuccess: async (result) => {
      setSelectedEpisode(result.episode.id);
      await queryClient.invalidateQueries({ queryKey: ["admin-season", params.id, selectedSeason] });
    },
  });

  const addMedia = useMutation({
    mutationFn: () =>
      seriesApi.addMedia(params.id, selectedSeason!, selectedEpisode!, {
        kind: mediaKind,
        quality: mediaKind === "video" ? mediaQuality : undefined,
        language: mediaLanguage,
        codec: mediaCodec || null,
        channels: mediaKind === "audio" ? Number(mediaChannels) || null : null,
        format: mediaKind === "subtitle" ? mediaFormat : null,
        status: "ready",
      }),
  });

  const saveMarkers = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      seriesApi.updateEpisode(params.id, selectedSeason!, selectedEpisode!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-season", params.id, selectedSeason] });
    },
  });

  const bulkPublish = useMutation({
    mutationFn: () =>
      seriesApi.bulkEpisodes(
        params.id,
        selectedSeason!,
        (seasonQuery.data?.episodes ?? []).map((item) => item.id),
        "publish",
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-season", params.id, selectedSeason] });
    },
  });

  if (!user || !hasMinimumRole(user.role, UserRole.Admin) || !query.data) {
    return <ScreenMessage>Loading series...</ScreenMessage>;
  }

  const series = query.data.series;

  return (
    <AdminPage
      title={series.title}
      actions={
        <>
          <Button onClick={() => publish.mutate()} disabled={series.published}>
            {series.published ? "Published" : "Publish series"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/series")}>
            Back
          </Button>
        </>
      }
    >
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Seasons</h2>
          <div className="flex gap-3">
            <Input
              type="number"
              className="w-24"
              value={seasonNumber}
              onChange={(e) => setSeasonNumber(Number(e.target.value))}
            />
            <Button onClick={() => addSeason.mutate()}>Add season</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {query.data.seasons.map((season) => (
              <Button
                key={season.id}
                size="sm"
                variant={selectedSeason === season.id ? "default" : "outline"}
                onClick={() => setSelectedSeason(season.id)}
              >
                {season.name}
              </Button>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Episodes</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Number</Label>
              <Input type="number" value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button disabled={!selectedSeason} onClick={() => addEpisode.mutate()}>
              Add episode
            </Button>
            <Button variant="outline" disabled={!selectedSeason} onClick={() => bulkPublish.mutate()}>
              Bulk publish episodes
            </Button>
          </div>
          <ul className="space-y-2 text-sm">
            {(seasonQuery.data?.episodes ?? []).map((episode) => (
              <li key={episode.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-3 py-2 text-left ${selectedEpisode === episode.id ? "bg-primary/20" : "bg-secondary"}`}
                  onClick={() => setSelectedEpisode(episode.id)}
                >
                  E{episode.episodeNumber}. {episode.title} · {episode.published ? "published" : "draft"} ·{" "}
                  {episode.availability}
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedEpisode ? (
          <section className="space-y-3">
            <h2 className="text-xl font-medium">Skip intro / recap</h2>
            <form
              key={selectedEpisode}
              className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                saveMarkers.mutate({
                  introStartSeconds: Number(data.get("introStartSeconds") || 0) || null,
                  introEndSeconds: Number(data.get("introEndSeconds") || 0) || null,
                  recapStartSeconds: Number(data.get("recapStartSeconds") || 0) || null,
                  recapEndSeconds: Number(data.get("recapEndSeconds") || 0) || null,
                  creditsStartSeconds: Number(data.get("creditsStartSeconds") || 0) || null,
                });
              }}
            >
              {(["introStartSeconds", "introEndSeconds", "recapStartSeconds", "recapEndSeconds", "creditsStartSeconds"] as const).map(
                (name) => (
                  <div key={name} className="space-y-2">
                    <Label>{name.replace("Seconds", "")}</Label>
                    <Input
                      name={name}
                      type="number"
                      defaultValue={
                        String(
                          (seasonQuery.data?.episodes.find((item) => item.id === selectedEpisode)?.markers as
                            | Record<string, number | null>
                            | undefined)?.[name] ?? "",
                        )
                      }
                    />
                  </div>
                ),
              )}
              <Button className="md:col-span-5" type="submit" disabled={saveMarkers.isPending}>
                Save skip markers
              </Button>
            </form>
          </section>
        ) : null}
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Episode media</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={mediaKind}
              onChange={(e) => setMediaKind(e.target.value)}
            >
              {MEDIA_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={mediaQuality}
              onChange={(e) => setMediaQuality(e.target.value)}
              disabled={mediaKind !== "video"}
            >
              {VIDEO_RESOLUTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={mediaLanguage}
              onChange={(e) => setMediaLanguage(e.target.value)}
            >
              {PROFILE_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageLabel(code)}
                </option>
              ))}
            </select>
            <Input value={mediaCodec} onChange={(e) => setMediaCodec(e.target.value)} placeholder="Codec" />
            <Input
              value={mediaChannels}
              onChange={(e) => setMediaChannels(e.target.value)}
              placeholder="Channels"
              disabled={mediaKind !== "audio"}
            />
            <select
              className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm"
              value={mediaFormat}
              onChange={(e) => setMediaFormat(e.target.value)}
              disabled={mediaKind !== "subtitle"}
            >
              {SUBTITLE_FORMATS.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
            <select className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm" defaultValue="ready">
              {MEDIA_ASSET_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!selectedEpisode} onClick={() => addMedia.mutate()}>
            Add track to selected episode
          </Button>
        </section>
    </AdminPage>
  );
}
