"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clapperboard,
  Film,
  SendHorizonal,
  Sparkles,
  Tv,
  UserRound,
} from "lucide-react";
import {
  ContentUploadRequestKind,
  MovieUploadRequestStatus,
  type ContentUploadRequestKind as Kind,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { movieUploadRequestApi } from "@/lib/movie-upload-request-api";
import { useProfileStore } from "@/stores/profile-store";
import styles from "./request-movie.module.css";

const STATUS_LABEL: Record<MovieUploadRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Added",
  rejected: "Unavailable",
};

const STATUS_CLASS: Record<MovieUploadRequestStatus, string> = {
  pending: styles.statusPending!,
  in_progress: styles.statusProgress!,
  fulfilled: styles.statusFulfilled!,
  rejected: styles.statusRejected!,
};

const STEPS = [
  { title: "Pick type", body: "Choose movie or TV show, then enter the title." },
  { title: "Team review", body: "We queue your request and check library availability." },
  { title: "Go live", body: "When the file is ready, it appears in your catalog." },
] as const;

const KIND_COPY: Record<
  Kind,
  { title: string; lead: string; fieldLabel: string; placeholder: string; notePlaceholder: string }
> = {
  [ContentUploadRequestKind.Movie]: {
    title: "Upload Request",
    lead: "Missing a film? Tell us the title and we'll add it when the file is available.",
    fieldLabel: "Movie title",
    placeholder: "e.g. John Wick",
    notePlaceholder: "Language, quality, or TMDB link…",
  },
  [ContentUploadRequestKind.Tv]: {
    title: "Request a TV show",
    lead: "Missing a series? Send the show name and we'll add it when episodes are ready.",
    fieldLabel: "TV show title",
    placeholder: "e.g. Breaking Bad",
    notePlaceholder: "Season, language, or TMDB link…",
  },
};

function parseKind(raw: string | null): Kind {
  return raw === ContentUploadRequestKind.Tv ? ContentUploadRequestKind.Tv : ContentUploadRequestKind.Movie;
}

export default function RequestMoviePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const kind = parseKind(searchParams.get("kind"));
  const copy = KIND_COPY[kind];

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [kind]);

  const featuresQuery = useQuery({
    queryKey: ["site-features"],
    queryFn: movieUploadRequestApi.features,
    staleTime: 30_000,
  });

  const mineQuery = useQuery({
    queryKey: ["movie-upload-requests-mine"],
    queryFn: movieUploadRequestApi.mine,
    enabled: Boolean(featuresQuery.data?.movieUploadRequestsEnabled),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      movieUploadRequestApi.create({
        kind,
        title: title.trim(),
        year: year.trim() ? Number(year) : undefined,
        note: note.trim() || undefined,
        profileId: activeProfile?.id,
      }),
    onSuccess: async () => {
      setError(null);
      setSuccess("Your request is in the queue. We'll update the status below when it's reviewed.");
      setTitle("");
      setYear("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["movie-upload-requests-mine"] });
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Could not submit request.");
    },
  });

  const setKind = (next: Kind) => {
    router.replace(`/home/request-movie?kind=${next}`);
  };

  if (featuresQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingShell}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.loadingText}>Loading request studio…</p>
        </div>
      </div>
    );
  }

  if (!featuresQuery.data?.movieUploadRequestsEnabled) {
    return (
      <div className={styles.page}>
        <div className={styles.offShell}>
          <Clapperboard className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className={styles.offTitle}>Requests paused</h1>
          <p className={styles.offLead}>Content requests are turned off for now. Please check back later.</p>
        </div>
      </div>
    );
  }

  const history = mineQuery.data ?? [];
  const HeroIcon = kind === ContentUploadRequestKind.Tv ? Tv : Film;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.gridBg} aria-hidden />
        <div className={styles.glow} aria-hidden />

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.iconRing}>
              <HeroIcon className="h-6 w-6" aria-hidden />
            </div>
            <p className={styles.eyebrow}>
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>AmarPin request studio</span>
            </p>
          </div>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.lead}>{copy.lead}</p>

          <div className={styles.kindToggle} role="group" aria-label="Content type">
            <button
              type="button"
              className={cn(styles.kindBtn, kind === ContentUploadRequestKind.Movie && styles.kindBtnActive)}
              onClick={() => setKind(ContentUploadRequestKind.Movie)}
            >
              <Film className="h-4 w-4" aria-hidden />
              Movie
            </button>
            <button
              type="button"
              className={cn(styles.kindBtn, kind === ContentUploadRequestKind.Tv && styles.kindBtnActive)}
              onClick={() => setKind(ContentUploadRequestKind.Tv)}
            >
              <Tv className="h-4 w-4" aria-hidden />
              TV show
            </button>
          </div>
        </header>

        <div className={styles.steps}>
          {STEPS.map((step, index) => (
            <div key={step.title} className={styles.step}>
              <span className={styles.stepNum}>{index + 1}</span>
              <p className={styles.stepText}>
                <strong>{step.title}</strong>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        {error ? (
          <div className={styles.feedback}>
            <p className={styles.feedbackError} role="alert">
              {error}
            </p>
          </div>
        ) : null}

        {success ? (
          <div className={styles.feedback}>
            <p className={styles.feedbackSuccess} role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>{success}</span>
            </p>
          </div>
        ) : null}

        <div className={styles.formCard}>
          <p className={styles.formTitle}>
            <SendHorizonal className="h-4 w-4 text-primary" aria-hidden />
            New request
          </p>

          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              setSuccess(null);
              void createMutation.mutate();
            }}
          >
            <div className={styles.field}>
              <Label htmlFor="req-title">{copy.fieldLabel}</Label>
              <Input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.placeholder}
                required
                maxLength={200}
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="req-year">Release year (optional)</Label>
              <Input
                id="req-year"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2014"
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="req-note">Details (optional)</Label>
              <textarea
                id="req-note"
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.notePlaceholder}
                maxLength={2000}
                rows={4}
              />
            </div>

            <div className={styles.submitRow}>
              <div>
                {activeProfile ? (
                  <span className={styles.profileChip}>
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                    Submitting as <strong>{activeProfile.name}</strong>
                  </span>
                ) : (
                  <p className={styles.hint}>Select a profile from the account menu if you share this account.</p>
                )}
              </div>
              <Button
                type="submit"
                className={styles.submitBtn}
                disabled={!title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Sending…" : "Submit request"}
              </Button>
            </div>
          </form>
        </div>

        {history.length > 0 ? (
          <section className={styles.history} aria-labelledby="request-history-title">
            <div className={styles.historyHead}>
              <h2 id="request-history-title" className={styles.historyTitle}>
                Your requests
              </h2>
              <span className={styles.historyCount}>{history.length} total</span>
            </div>
            <ul className={styles.historyList}>
              {history.map((row, index) => (
                <li
                  key={row.id}
                  className={styles.historyItem}
                  style={{ animationDelay: `${0.08 * index}s` }}
                >
                  <div className="min-w-0">
                    <p className={styles.historyKind}>
                      {row.kind === ContentUploadRequestKind.Tv ? "TV show" : "Movie"}
                    </p>
                    <p className={styles.historyMovie}>
                      {row.title}
                      {row.year ? ` (${row.year})` : ""}
                    </p>
                    {row.note ? <p className={styles.note}>{row.note}</p> : null}
                  </div>
                  <span className={cn(styles.status, STATUS_CLASS[row.status])}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
