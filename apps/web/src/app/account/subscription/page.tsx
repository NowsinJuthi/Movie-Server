"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, MonitorSmartphone, Sparkles, Wallet } from "lucide-react";
import { BillingCycle, type PublicSubscription } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCents, subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { PageShell } from "@/components/layout/page-shell";
import { SubscribePricingSection } from "@/components/subscribe/subscribe-pricing-section";
import styles from "./subscription-page.module.css";

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuthStore();
  const [cycle, setCycle] = useState<BillingCycle>(BillingCycle.Monthly);
  const [planError, setPlanError] = useState<string | null>(null);

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: subscriptionApi.plans });
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

  const sub = meQuery.data?.subscription;
  const entitlement = meQuery.data?.entitlement;

  useEffect(() => {
    if (sub?.billingCycle) {
      setCycle(sub.billingCycle);
    }
  }, [sub?.billingCycle]);

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

  const start = useMutation({
    mutationFn: async ({ slug }: { slug: string }) => {
      const started = await subscriptionApi.start(slug, cycle);
      if (started.paymentRequired) {
        const checkout = await billingApi.checkout({ subscriptionId: started.subscription.id });
        return { checkoutUrl: checkout.checkoutUrl };
      }
      return { checkoutUrl: null as string | null };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
    },
    onError: (err: unknown) => {
      setPlanError(err instanceof ApiError ? err.message : "Unable to start a subscription.");
    },
  });

  const change = useMutation({
    mutationFn: ({ slug }: { slug: string }) => subscriptionApi.change(slug, cycle),
    onSuccess: async () => {
      setPlanError(null);
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-changes"] });
    },
    onError: (err: unknown) => {
      setPlanError(err instanceof ApiError ? err.message : "Unable to change plan.");
    },
  });

  const plans = useMemo(
    () => [...(plansQuery.data?.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plansQuery.data],
  );

  const handleSelectPlan = (slug: string) => {
    setPlanError(null);
    if (sub) {
      change.mutate({ slug });
      return;
    }
    start.mutate({ slug });
  };

  const manageError =
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

  return (
    <PageShell
      title="Subscription"
      description="Your plan, renewal dates, and switches — all on one page."
      error={manageError}
      actions={
        <div className={styles.quickLinks}>
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
        {sub ? (
          <SubscriptionStatusBar
            sub={sub}
            entitled={Boolean(entitlement?.entitled)}
            cancel={cancel}
            resume={resume}
          />
        ) : (
          <section className={styles.emptyCard}>
            <CreditCard className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <h2 className={styles.emptyTitle}>No subscription yet</h2>
            <p className={styles.emptyLead}>
              Choose a plan below — the card you pick becomes your account plan after checkout.
            </p>
          </section>
        )}

        {plansQuery.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No plans available yet.</p>
        ) : (
          <SubscribePricingSection
            layout="account"
            plans={plans}
            cycle={cycle}
            onCycleChange={setCycle}
            error={planError}
            currentSlug={sub?.plan.slug}
            entitled={Boolean(entitlement?.entitled)}
            busy={start.isPending || change.isPending}
            onSelectPlan={handleSelectPlan}
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

function SubscriptionStatusBar({
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
  return (
    <section className={styles.statusBar} aria-label="Current subscription status">
      <div className={styles.statusMain}>
        <p className={styles.statusEyebrow}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          You are on {sub.plan.name}
        </p>
        <p className={styles.statusMeta}>
          <span className={cn(styles.statusChip, "capitalize")}>{formatStatus(sub.status)}</span>
          <span className={styles.statusDot} aria-hidden>
            ·
          </span>
          <span>{formatCents(sub.priceCents, sub.currency)}</span>
          <span className={styles.statusDot} aria-hidden>
            ·
          </span>
          <span className="capitalize">{sub.billingCycle} billing</span>
        </p>
        <p className={styles.statusRenewal}>
          Period ends {new Date(sub.currentPeriodEnd).toLocaleString()}
          {sub.trialEnd ? (
            <> · Trial ends {new Date(sub.trialEnd).toLocaleString()}</>
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
      </div>
      <span
        className={cn(
          styles.statusPill,
          entitled ? styles.statusActive : styles.statusMuted,
        )}
      >
        {entitled ? "Streaming active" : "No access"}
      </span>
      <div className={styles.statusActions}>
        {sub.status === "pending" ? (
          <PayButton label="Complete payment" kind="checkout" />
        ) : null}
        {sub.status === "suspended" || sub.status === "expired" ? (
          <PayButton label="Pay to renew" kind="renewal" />
        ) : null}
        {sub.status === "cancelled" ? (
          <Button size="sm" onClick={() => resume.mutate()} disabled={resume.isPending}>
            Resume subscription
          </Button>
        ) : sub.status === "expired" ? (
          <Button size="sm" asChild>
            <Link href="#account-plans-heading">Choose a new plan</Link>
          </Button>
        ) : sub.status !== "pending" ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            Cancel at period end
          </Button>
        ) : null}
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
    <Button size="sm" onClick={() => pay.mutate()} disabled={pay.isPending}>
      {pay.isPending ? "Redirecting…" : label}
    </Button>
  );
}
