"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  MonitorSmartphone,
  Sparkles,
  Tv,
  Wallet,
} from "lucide-react";
import { PlanFeature, type PublicSubscription } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCents, subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { PageShell } from "@/components/layout/page-shell";
import styles from "./subscription-page.module.css";

const FEATURE_LABELS: Record<PlanFeature, string> = {
  [PlanFeature.Catalog]: "Full catalog",
  [PlanFeature.Hd]: "HD streaming",
  [PlanFeature.Uhd]: "4K Ultra HD",
  [PlanFeature.Downloads]: "Downloads",
  [PlanFeature.Hdr]: "HDR",
  [PlanFeature.SpatialAudio]: "Spatial audio",
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();
  const meQuery = useQuery({
    queryKey: ["subscription-me"],
    queryFn: subscriptionApi.me,
    enabled: status === "authenticated",
  });
  const historyQuery = useQuery({
    queryKey: ["subscription-history"],
    queryFn: subscriptionApi.history,
    enabled: status === "authenticated",
  });
  const changesQuery = useQuery({
    queryKey: ["subscription-changes"],
    queryFn: subscriptionApi.changes,
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/account/subscription");
    }
  }, [status, router]);

  const cancel = useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-history"] });
    },
  });
  const resume = useMutation({
    mutationFn: subscriptionApi.resume,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
    },
  });

  const error =
    cancel.error instanceof ApiError
      ? cancel.error.message
      : resume.error instanceof ApiError
        ? resume.error.message
        : null;

  if (status === "loading" || status === "idle" || meQuery.isLoading) {
    return (
      <PageShell title="Subscription" description="Manage your plan and billing access.">
        <div className={styles.loading}>
          <div className={styles.spinner} aria-hidden />
          <p className="text-sm text-muted-foreground">Loading subscription…</p>
        </div>
      </PageShell>
    );
  }

  const sub = meQuery.data?.subscription;
  const entitlement = meQuery.data?.entitlement;

  return (
    <PageShell
      title="Subscription"
      description="Your plan, renewal dates, and account access in one place."
      error={error}
      actions={
        <div className={styles.quickLinks}>
          <Link href="/subscribe" className={styles.quickLink}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Change plan
          </Link>
          <Link href="/account/billing" className={styles.quickLink}>
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            Billing
          </Link>
          <Link href="/account/devices" className={styles.quickLink}>
            <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden />
            Devices
          </Link>
        </div>
      }
    >
      <div className={styles.wrap}>
        {!sub ? (
          <section className={styles.emptyCard}>
            <CreditCard className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <h2 className={styles.emptyTitle}>No active subscription</h2>
            <p className={styles.emptyLead}>
              Pick a plan to unlock streaming on AmarPin. You can switch or cancel anytime.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/subscribe">View plans</Link>
            </Button>
          </section>
        ) : (
          <PlanHero
            sub={sub}
            entitled={Boolean(entitlement?.entitled)}
            cancel={cancel}
            resume={resume}
          />
        )}

        <HistoryBlock
          title="Subscription activity"
          events={historyQuery.data?.events ?? []}
        />
        <HistoryBlock title="Plan changes" events={changesQuery.data?.events ?? []} />
      </div>
    </PageShell>
  );
}

function PlanHero({
  sub,
  entitled,
  cancel,
  resume,
}: {
  sub: PublicSubscription;
  entitled: boolean;
  cancel: { mutate: () => void; isPending: boolean };
  resume: { mutate: () => void; isPending: boolean };
}) {
  const features =
    sub.plan.features.length > 0
      ? sub.plan.features.map((f) => FEATURE_LABELS[f]).join(", ")
      : "Catalog access";

  return (
    <section className={styles.heroCard}>
      <div className={styles.heroGrid} aria-hidden />
      <div className={styles.heroInner}>
        <div className={styles.heroTop}>
          <div className="min-w-0">
            <p className={styles.eyebrow}>
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Current plan
            </p>
            <h2 className={styles.planName}>{sub.plan.name}</h2>
            <p className={cn(styles.planMeta, "capitalize")}>
              {formatStatus(sub.status)} · {sub.billingCycle} billing
            </p>
            <p className={styles.planPrice}>{formatCents(sub.priceCents, sub.currency)}</p>
          </div>
          <span
            className={cn(
              styles.statusPill,
              entitled ? styles.statusActive : styles.statusMuted,
            )}
          >
            {entitled ? "Streaming active" : "No access"}
          </span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Quality</p>
            <p className={styles.statValue}>{sub.plan.maxVideoQuality.toUpperCase()}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Streams</p>
            <p className={styles.statValue}>{sub.plan.maxStreams}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Devices</p>
            <p className={styles.statValue}>{sub.plan.maxDevices}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Features</p>
            <p className={styles.statValue}>{features}</p>
          </div>
        </div>

        <p className={styles.notice}>
          <strong>Current period ends</strong> {new Date(sub.currentPeriodEnd).toLocaleString()}
          {sub.trialEnd ? (
            <>
              {" "}
              · <strong>Trial ends</strong> {new Date(sub.trialEnd).toLocaleString()}
            </>
          ) : null}
          {sub.scheduledPlanId ? (
            <>
              {" "}
              · Downgrade scheduled{" "}
              {sub.scheduledChangeAt
                ? new Date(sub.scheduledChangeAt).toLocaleString()
                : "at period end"}
            </>
          ) : null}
        </p>

        <div className={styles.actions}>
          {sub.status === "pending" ? (
            <PayButton label="Complete payment" kind="checkout" />
          ) : null}
          {sub.status === "suspended" || sub.status === "expired" ? (
            <PayButton label="Pay to renew" kind="renewal" />
          ) : null}
          {sub.status === "cancelled" ? (
            <Button onClick={() => resume.mutate()} disabled={resume.isPending}>
              Resume subscription
            </Button>
          ) : sub.status === "expired" ? (
            <Button asChild>
              <Link href="/subscribe">Start a new plan</Link>
            </Button>
          ) : sub.status !== "pending" ? (
            <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Cancel at period end
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/subscribe">
              <Tv className="mr-1.5 h-4 w-4" aria-hidden />
              Compare plans
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function HistoryBlock({
  title,
  events,
}: {
  title: string;
  events: {
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    toPlanSlug: string | null;
  }[];
}) {
  return (
    <section className={styles.historySection}>
      <div className={styles.historyHead}>
        <h2 className={styles.historyTitle}>{title}</h2>
        <span className={styles.historyCount}>{events.length} events</span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ol className={styles.timeline}>
          {events.map((event) => (
            <li key={event.id} className={styles.timelineItem}>
              <p className={styles.eventType}>{event.type.replaceAll("_", " ")}</p>
              {event.toPlanSlug ? (
                <p className={styles.eventMeta}>Plan: {event.toPlanSlug}</p>
              ) : null}
              <p className={styles.eventMeta}>{new Date(event.createdAt).toLocaleString()}</p>
              {event.note ? <p className={styles.eventMeta}>{event.note}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PayButton({ label, kind }: { label: string; kind: "checkout" | "renewal" }) {
  const pay = useMutation({
    mutationFn: () => billingApi.checkout({ kind }),
    onSuccess: (data) => {
      window.location.assign(data.checkoutUrl);
    },
  });
  return (
    <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
      {pay.isPending ? "Redirecting…" : label}
    </Button>
  );
}
