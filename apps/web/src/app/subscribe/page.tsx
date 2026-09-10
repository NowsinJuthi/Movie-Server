"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BillingCycle,
  PLAN_FEATURES,
  type PublicPlan,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { formatCents, subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";

export default function SubscribePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);
  const [cycle, setCycle] = useState<BillingCycle>(BillingCycle.Monthly);
  const [error, setError] = useState<string | null>(null);

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: subscriptionApi.plans });
  const meQuery = useQuery({
    queryKey: ["subscription-me"],
    queryFn: subscriptionApi.me,
    enabled: status === "authenticated",
  });

  const start = useMutation({
    mutationFn: async ({ slug }: { slug: string }) => {
      const started = await subscriptionApi.start(slug, cycle);
      if (started.paymentRequired) {
        const checkout = await billingApi.checkout({ subscriptionId: started.subscription.id });
        return { ...started, checkoutUrl: checkout.checkoutUrl };
      }
      return { ...started, checkoutUrl: null as string | null };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      router.push("/account/subscription");
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Unable to start a subscription.");
    },
  });

  const change = useMutation({
    mutationFn: ({ slug }: { slug: string }) => subscriptionApi.change(slug, cycle),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription-me"] });
      router.push("/account/subscription");
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Unable to change plan.");
    },
  });

  const current = meQuery.data?.subscription;
  const plans = useMemo(
    () => [...(plansQuery.data?.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plansQuery.data],
  );

  return (
    <main className="auth-backdrop min-h-screen">
      <header className="mx-auto flex w-full items-center justify-between px-3 py-6 sm:px-4 md:px-5 lg:px-6">
        <Link href="/" className="text-2xl font-bold text-primary">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-8 w-auto max-w-[180px] object-contain" />
          ) : (
            siteName
          )}
        </Link>
        <div className="flex gap-3">
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/account/subscription">Manage</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app">Back to app</Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/login?next=/subscribe">Sign in</Link>
            </Button>
          )}
        </div>
      </header>
      <section className="mx-auto w-full px-3 pb-20 sm:px-4 md:px-5 lg:px-6">
        <div className="rounded-xl border border-border bg-card/40 p-4 sm:p-5 md:p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Plans</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Choose a plan that fits your library.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Access is authorized on the server. The plan you pick here is verified again before every
          playback request.
        </p>
        <div className="mt-8 inline-flex rounded-full border border-border bg-card p-1">
          <CycleButton active={cycle === BillingCycle.Monthly} onClick={() => setCycle(BillingCycle.Monthly)}>
            Monthly
          </CycleButton>
          <CycleButton active={cycle === BillingCycle.Yearly} onClick={() => setCycle(BillingCycle.Yearly)}>
            Yearly
          </CycleButton>
        </div>
        {error ? <Alert className="mt-6 max-w-xl">{error}</Alert> : null}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              currentSlug={current?.plan.slug}
              entitled={Boolean(meQuery.data?.entitlement.entitled)}
              busy={start.isPending || change.isPending}
              onSelect={() => {
                setError(null);
                if (!user) {
                  router.push("/login?next=/subscribe");
                  return;
                }
                if (current && meQuery.data?.entitlement.entitled) {
                  change.mutate({ slug: plan.slug });
                } else {
                  start.mutate({ slug: plan.slug });
                }
              }}
            />
          ))}
        </div>
        </div>
      </section>
    </main>
  );
}

function CycleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  cycle,
  currentSlug,
  entitled,
  busy,
  onSelect,
}: {
  plan: PublicPlan;
  cycle: BillingCycle;
  currentSlug?: string;
  entitled: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const price = cycle === BillingCycle.Yearly ? plan.yearlyPriceCents : plan.monthlyPriceCents;
  const isCurrent = entitled && currentSlug === plan.slug;
  return (
    <article className={`flex flex-col rounded-2xl border bg-card p-6 ${plan.tier === "premium" ? "border-primary" : "border-border"}`}>
      <p className="text-sm uppercase tracking-widest text-muted-foreground">{plan.tier}</p>
      <h2 className="mt-2 text-2xl font-semibold">{plan.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
      <p className="mt-6 text-3xl font-semibold">
        {formatCents(price, plan.currency)}
        <span className="text-base font-normal text-muted-foreground">
          /{cycle === BillingCycle.Yearly ? "year" : "month"}
        </span>
      </p>
      {plan.trialDays > 0 ? (
        <p className="mt-2 text-sm text-primary">{plan.trialDays}-day free trial for new accounts</p>
      ) : null}
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>Video quality: {plan.maxVideoQuality.toUpperCase()}</li>
        <li>{plan.maxStreams} simultaneous stream{plan.maxStreams === 1 ? "" : "s"}</li>
        <li>{plan.maxDevices} registered device{plan.maxDevices === 1 ? "" : "s"}</li>
        {PLAN_FEATURES.filter((feature) => plan.features.includes(feature)).map((feature) => (
          <li key={feature} className="capitalize">
            {feature.replace("_", " ")}
          </li>
        ))}
      </ul>
      <Button className="mt-8" disabled={busy || isCurrent} onClick={onSelect}>
        {isCurrent ? "Current plan" : entitled ? "Switch to this plan" : "Start plan"}
      </Button>
    </article>
  );
}
