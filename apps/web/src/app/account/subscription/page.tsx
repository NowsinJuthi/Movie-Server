"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { formatCents, subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { PageShell } from "@/components/layout/page-shell";

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

  if (status === "loading" || status === "idle") {
    return <ScreenMessage>Loading subscription...</ScreenMessage>;
  }

  const sub = meQuery.data?.subscription;
  const entitlement = meQuery.data?.entitlement;
  const error =
    cancel.error instanceof ApiError
      ? cancel.error.message
      : resume.error instanceof ApiError
        ? resume.error.message
        : null;

  return (
    <PageShell
      title="Subscription"
      description="Manage your plan and billing access."
      error={error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/subscribe">Change plan</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/devices">Devices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/billing">Billing</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/home">Back</Link>
          </Button>
        </div>
      }
    >
        {!sub ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground">You do not have a subscription yet.</p>
            <Button className="mt-4" asChild>
              <Link href="/subscribe">Choose a plan</Link>
            </Button>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{sub.plan.name}</h2>
                <p className="mt-1 capitalize text-muted-foreground">
                  {sub.status} · {sub.billingCycle} · {formatCents(sub.priceCents, sub.currency)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Period ends {new Date(sub.currentPeriodEnd).toLocaleString()}
                </p>
                {sub.trialEnd ? (
                  <p className="mt-1 text-sm text-primary">
                    Trial ends {new Date(sub.trialEnd).toLocaleString()}
                  </p>
                ) : null}
                {sub.scheduledPlanId ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    A downgrade is scheduled for {sub.scheduledChangeAt ? new Date(sub.scheduledChangeAt).toLocaleString() : "period end"}.
                  </p>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-sm ${entitlement?.entitled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {entitlement?.entitled ? "Access granted" : "No access"}
              </span>
            </div>
            <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li>Max quality: {sub.plan.maxVideoQuality.toUpperCase()}</li>
              <li>Streams: {sub.plan.maxStreams}</li>
              <li>Devices: {sub.plan.maxDevices}</li>
              <li>Features: {sub.plan.features.join(", ") || "catalog"}</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
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
            </div>
          </section>
        )}
        <History title="Subscription history" events={historyQuery.data?.events ?? []} />
        <History title="Plan-change history" events={changesQuery.data?.events ?? []} />
    </PageShell>
  );
}

function History({
  title,
  events,
}: {
  title: string;
  events: { id: string; type: string; note: string | null; createdAt: string; toPlanSlug: string | null }[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-medium">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-md border border-border px-4 py-3 text-sm">
              <span className="font-medium capitalize">{event.type.replaceAll("_", " ")}</span>
              {event.toPlanSlug ? <span className="text-muted-foreground"> · {event.toPlanSlug}</span> : null}
              <p className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
              {event.note ? <p className="mt-1 text-muted-foreground">{event.note}</p> : null}
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
      {pay.isPending ? "Redirecting..." : label}
    </Button>
  );
}
