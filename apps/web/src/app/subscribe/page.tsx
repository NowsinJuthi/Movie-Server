"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BillingCycle } from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";
import { SubscribePricingSection } from "@/components/subscribe/subscribe-pricing-section";

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

  const handleSelectPlan = (slug: string) => {
    setError(null);
    if (!user) {
      router.push("/login?next=/subscribe");
      return;
    }
    if (current && meQuery.data?.entitlement.entitled) {
      change.mutate({ slug });
    } else {
      start.mutate({ slug });
    }
  };

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
                <Link href="/home">Back to home</Link>
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
        {plansQuery.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading plans...</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No plans available yet.</p>
        ) : (
          <SubscribePricingSection
            plans={plans}
            cycle={cycle}
            onCycleChange={setCycle}
            error={error}
            currentSlug={current?.plan.slug}
            entitled={Boolean(meQuery.data?.entitlement.entitled)}
            busy={start.isPending || change.isPending}
            onSelectPlan={handleSelectPlan}
          />
        )}
      </section>
    </main>
  );
}
