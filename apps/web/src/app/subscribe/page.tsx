"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BillingCycle } from "@movie-server/shared";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api";
import { subscriptionApi } from "@/lib/subscription-api";
import { billingApi } from "@/lib/billing-api";
import { SubscribePricingSection } from "@/components/subscribe/subscribe-pricing-section";

export default function SubscribePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
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
    <main className="auth-backdrop min-h-[100dvh] pt-16">
      <section className="mx-auto w-full px-3 pb-8 pt-4 sm:px-4 md:px-5 lg:px-6 lg:pb-12">
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
